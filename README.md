timecop.js
==========

A node app that will monitor Traffic Live via the API and send reminder texts/emails when a user has not entered their hours.

Documented [source code](http://dtex.github.com/timecop/docs/timecop.html)

## Getting Started ##

Grab the files from the [https://github.com/dtex/timecop/downloads](downloads) and unzip to the folder where you would like for timecop to reside.

From the command line run "npm install" from the folder.

##Configure your install##
Rename sample-config.json to config.json and edit as described below.

Enter your apiToken here

    "apiToken": "*********************",

The email address from Traffic that is associated with the token

    "email": "apiuser@yourcommpany.com",

Enter your SMTP server details

    "smtp": {
        "host": "smtp.sendgrid.net",
        "port": "587",
        "user": "********",
        "pass": "********"
    },
		
jobs is an array of job objects. Each job object consists of:
 schedule: a [cron formatted](http://www.nncron.ru/help/EN/working/cron-format.htm) string,
 type: Currently the only valid value is checkHours. We may add more types later,
 maxGap: The maximum allowable number of hours a user may fall bahind.

     "jobs": [
        {
            "schedule": "00 00 08 * * 2-6",
            "type": "checkHours",
            "maxGap": 8
        },
        {
            "schedule": "00 00 [12,16] * * 2-6",
            "type": "checkHours",
            "maxGap": 20
        },
        {
            "schedule": "00 00 20 * * 2-6",
            "type": "checkHours",
            "maxGap": 40
        }
    ],

This example equates to:
* Every M-F at 8am notify users who are more than 8 hours behind
* Every M-F at noon and 4pm notify users who are more than 20 hours behind
* Every M-F at 8pm notify users who are more than 40 hours behind
	
templates is an object that contains all the templates used (currently only hours for jobs.type checkHours). This is the template for the email that will be sent to users.

    "templates": {
        "hours": "<p><b>Hi <span id=\"name\"></span>, you have billed <span id=\"minutes\"></span> hours so far this month</b></p><p><span id=\"billable\"></span> of those were billable.</p><p>You should have billed <span id=\"available\"></span> hours by now.</p>"
    }
    
This span will be populated with the user's full name.

    <span id=\"name\"></span> 

This span will contain the number of hours billed so far.

    <span id=\"minutes\"></span>

This span will contain the number of billable hours billed so far.

    <span id=\"billable\"></span>

This span will contain the number of hours that should have been billed by the end of the previous day.
    
    <span id=\"available\"></span>
    
## Running the app##
	
Simply type "node timecop" from the command line. timecop will run itself as a daemon.
