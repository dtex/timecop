timecop.js
==========

A node app that will monitor Traffic Live via the API and send reminder emails when a user has not entered their hours.

Documented [source code](http://dtex.github.com/timecop/docs/timecop.html)

I have only tested in node 0.6.18

### We're definitely not working in node 0.8.x just yet! ###

## Getting Started ##

You'll need node.js of course. Get it from [nodejs.org](http://nodejs.org).

You'll need libxml installed. Get it from [xmlsoft.org](http://www.xmlsoft.org/downloads.html).

Grab the timecop files from the [downloads](https://github.com/dtex/timecop/downloads) and unzip to the folder where you would like for timecop to reside.

From the command line run "npm install" inside the timecop folder.

##Configure your install##

Rename sample-config.json to config.json and edit as described below.

### API Configuration ###

Enter your Traffic Live apiToken here

    "apiToken": "*********************",

The email address from Traffic that is associated with the token

    "email": "apiuser@yourcommpany.com",

### SMTP Configuration ###

Enter your SMTP server details

    "smtp": {
        "host": "smtp.sendgrid.net",
        "port": "587",
        "user": "********",
        "pass": "********"
    },

### Job Scheduling ###
		
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

Be sure to check the system time where timecop will be running. I spent more time than I care to admit debugging the job scheduler when it turned out that the system time was just wrong.
	
### Email Templates ###

templates is an object that contains all the templates used (currently only hours for jobs.type checkHours). This is the template for the email that will be sent to users. Feel free to make it as fancy as you like.

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
    
## Running the app ##
	
From the command line run "node timecop". Node will run as a process until the current terminal session has ended.

Running "node timecop --mode test" will do the same, but will trigger an immediate time check with a maxGap of 8, regardless of the schedule and will only send an email to the Traffic API user (not to all users).

Running "node timecop --mode daemon" will run timecop as a daemon so that it stays running even after the current terminal session has ended. It will NOT restart timecop if timecop or the server crashes for some reason.