timecop.js
==========

A node app that will monitor Traffic Live via the API and send reminder texts/emails when a user has not entered their hours.

Documented [source code[(http://dtex.github.com/timecop/docs/timecop.html)

	{
		"apiToken": "*********************",
		"email": "donovan@brandextract.com",
		"defaultMaxGap": 8,
		"smtp": {
			"host": "smtp.sendgrid.net",
			"port": "587",
			"user": "no-reply@brandextract.com",
			"pass": "********"
		},
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
		"templates": {
			"hours": "<p><b>Hi <span id=\"name\"></span>, you have billed <span id=\"minutes\"></span> hours so far this month</b></p><p><span id=\"billable\"></span> of those were billable.</p><p>You should have billed <span id=\"available\"></span> hours by now.</p>"
		}
	}