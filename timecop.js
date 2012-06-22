var libxmljs = require("libxmljs"),
	neuron = require('neuron'),
	utile = require('utile'),
	nconf = require('nconf'),
	xmlDoc, 
	https = require('https'),
	timecop = {},
	nodemailer = require("nodemailer"),
	cronJob = require("cron").CronJob,
	plates = require("plates");

//
// ### Version 0.0.1
//
timecop.version = [0, 0, 1];

// load our config file
nconf.file({ file: './config.json' });

// This is the default value for the max # of hours the user can fall behind before being notified.
timecop.maxGap = nconf.get("defaultMaxGap");

var manager = new neuron.JobManager();

//
// ### Retrieve a list of all users from Traffic
//
manager.addJob('checkHours', {

	work: function ( nconf, maxGap ) {
		
		var now = new Date();
		var self = this;
		timecop.maxGap = maxGap;
		
		var req = https.request({
			host: "production-sohnar.apigee.com", 
			headers: {
				"Accept": "application/xml", 
				"Authorization": "Basic " + nconf.get("apiToken")},
				// If you have more than 500 employees change this. We have less than 50 so we haven't tested on bigger installs.
				"path": "/TrafficLiteServer/openapi/staff/employee?windowSize=500",
				"port": 443,
				"method": 'GET'}, 
			
			function(res) {
				var body = '';
				
				res.on('data', function (chunk) {
					body+=chunk;
				});
				
				res.on('end', function () {
					
					// load response as XML document
					xmlDoc = libxmljs.parseXmlString(body);
					
					// Get a node list of the employees
					var Employees = xmlDoc.find("/pagedResult/trafficEmployee");
					
					// Loop through the employee nodes
					for (i = 0, j = Employees.length; i<j; i++) {
						
						var available = 0,
							now = new Date(),
							hpd = Number(Employees[i].find("employeeDetails/hoursWorkedPerDayMinutes")[0].text());
						
						// Loop through all the days of this month. If it is a weekday, increase the hours the employee was available by hoursWorkedPerDayMinutes value from traffic
						for (k = 1, l = now.getDate(); k < l; k++) {
							var thisDate = new Date(now.getFullYear(), now.getMonth(), k);
							if (thisDate.getDay() > 0 && thisDate.getDay() < 6) {
								available += hpd;
							}
						}
						
						// Create some nodes we will use later
						var newBillable = new libxmljs.Element(xmlDoc, "billable", 0),
							newMinutes = new libxmljs.Element(xmlDoc, "minutes", 0),
							newAvailable = new libxmljs.Element(xmlDoc, "available", String(available));
											
						// Add the nodes to our XML document
						Employees[i].addChild(newBillable);
						Employees[i].addChild(newMinutes);
						Employees[i].addChild(newAvailable);
						
					}
									
					manager.enqueue('getTimeEntries' );
					self.finished = true;
				});
				
			}
		);
		
		req.end();
		
		req.on('error', function(e) {
			console.error(e);
		});		
		
	}
});

//
// ### Get all all the days for the current month
//
manager.addJob('getTimeEntries', {
	work: function ( ) {
		
		var self = this,
			now = new Date(),
			counter = now.getDate();
							
		// Loop thorugh all the days so far this month
		for (var i = 1, j = now.getDate(); i <= j; i++) {
				manager.enqueue('getDay', i);				
		}
		
		self.finished = true;
		
	}
});

//
// ### Get all teh time entries for this day
//
manager.addJob('getDay', {
	work: function ( day ) {
		var now = new Date(),
			self = this;
		// Request all the time entries for this day (max=999). If your company has more than 999 time entries per day open an issue on github and we'll think about it.
		var req = https.request({host: "production-sohnar.apigee.com", headers: {"Accept": "application/xml", "Authorization": "Basic " + nconf.get("apiToken")},path: "/TrafficLiteServer/openapi/timeentries?startDate=" + now.getFullYear() + "-" + timecop.twoDigit(now.getMonth()+1) + "-" + timecop.twoDigit(day) + "&endDate=" + now.getFullYear() + "-" + timecop.twoDigit(now.getMonth()+1) + "-" + timecop.twoDigit(day + 1) +"&windowSize=999",port:443,method:'GET'}, 
			function(res) {
				
				var body = '',
					thisDate = new Date(now.getFullYear(), now.getMonth(), day);
				
				res.on('data', function (chunk) {
					body+=chunk;
				});
				
				res.on('end', function () {
					
					// Load the XML
					var timeEntries = libxmljs.parseXmlString(body);
					
					// Get a node list of all time entries
					var timeEntry = timeEntries.find("jobTaskTimeEntry");
					
					// Loop through all the time entries
					for (k = 0, l = timeEntry.length; k < l; k++) {
						
						// Get details of this time entry
						var billable = timeEntry[k].find('billable')[0].text();
						var minutes = Number(timeEntry[k].find('minutes')[0].text());
						var user = timeEntry[k].find('trafficEmployeeId/id')[0].text();
						
						// Find this employee who made the entry and get some details
						var Employee = xmlDoc.find("/pagedResult/trafficEmployee[@id = '" + user +"']");
						var billableSoFar = Employee[0].find("billable")[0];
						var minutesSoFar = Employee[0].find("minutes")[0];
						
						// If this task is billable, add the time to the billable total
						if (billable === "true") {
							var t = Number(billableSoFar.text());
							billableSoFar.text(String(t + minutes));
						}
						
						// Add the time to the total time
						var t = Number(minutesSoFar.text());
						minutesSoFar.text(String(t + minutes));
						
					}
					
					self.finished = true;
					
				});

			}
		);
		
		req.end();
		
		req.on('error', function(e) {
			console.error(e);
		});	
	}
});

//
// ### Send alerts to users
//
manager.addJob('outputResults', {
	work: function ( ) {
		
		var self = this
			now = new Date();
		
		
		// Get a node list of all the users
		var users = xmlDoc.find("/pagedResult/trafficEmployee");
		
		// create reusable transport method (opens pool of SMTP connections)
		var smtpTransport = nodemailer.createTransport("SMTP",{
		    host: nconf.get("smtp:host"),
		    port: nconf.get("smtp:port"),
		    auth: {
		        user: nconf.get("smtp:user"),
		        pass: nconf.get("smtp:pass")
		    }
		});

		// Loop through all the users
		for (i = 0, j= users.length; i<j; i++) {
			
			var user = users[i];
			var name = user.find("employeeDetails/personalDetails/firstName")[0].text() + " " + user.find("employeeDetails/personalDetails/lastName")[0].text();
			
			var billable = user.find("billable"),
				minutes = user.find("minutes"),
				available = user.find("available"),
				useremail = user.find("employeeDetails/personalDetails/emailAddress")[0].text();
			
			// Only send email to users in the beta program
			if (useremail === 'donovan@brandextract.com' || useremail === 'xsean@brandextract.com') {
				// If this user has billed any time, and that time exceeds maxGap hours 
				if (Number(minutes[0].text()) > 0 && (Number(available[0].text())/60.0 - Number(minutes[0].text())/60.0 > timecop.maxGap)) {
					
					// Populate template
					var html = nconf.get("templates:hours");
					var data = { 
						"name": name,
						"minutes": String((Number(minutes[0].text())/60.0).toFixed(1)),
						"billable": String((Number(billable[0].text())/60.0).toFixed(1)),
						"available":String((Number(available[0].text())/60.0).toFixed(1))
					};
					var output = plates.bind(html, data); 
					
					// Create email
					var mailOptions = {
					    from: "Timecop ✔ <no-reply@brandextract.com>",
					    to: useremail,
					    subject: "Ketchup! " + now.toString(),
					    text: output,
					    html: output,
					    headers: {"X-SMTPAPI": {"category": "Timecop"}}
					}
					
					// send mail with defined transport object
					smtpTransport.sendMail(mailOptions, function(error, response){
					    if(error){
					        console.log(error);
					   }
					
					});
				}
			}
		}
		self.finished = true;
	}
});

// 
// ### Fires every time a job finshes
//
 manager.on('finish', function (job, worker) {
		
	var idle = true;
	
	for (i = 0, j = Object.keys(this.jobs).length; i<j; i++ ) {
		var name = Object.keys(this.jobs)[i];
		if ( Object.keys(this.jobs[name].running).length > 0 || this.jobs[name].queue.length > 0) idle = false;
	}

	// If we are idle and the last job to run was getDay, it must be time to output results
	if (job.name == 'getDay' && idle) {
		manager.enqueue('outputResults');
	}
});
	
//
// ### Convert a single digit number to a two digit string
//
timecop.twoDigit = function( value ) {
	value= String(value);
	if (value.length === 1) value = "0" + value;
	return value;
}

//
// ## Entry point
//
var jobs = nconf.get("jobs");

// Loop through all the jobs in the config.json file and put them on chron
utile.each(jobs, function(job, key, obj) {
	new cronJob(job.schedule, 
		function(){
	    	manager.enqueue(job.type, nconf, job.maxGap);  
	    }, null, true
	);
});