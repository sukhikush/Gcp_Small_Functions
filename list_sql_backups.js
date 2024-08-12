process.env.GOOGLE_APPLICATION_CREDENTIALS = 'local-acess.json'
// const projectId = "da-tf-project-1-1b0f";
// const instanceId = "dev-da-db-instance-6bdae737";

require('dotenv').config()
const { google } = require('googleapis')
const email = require('./email')

const listCloudSqlBackups = async function (req, res) {
  console.log('Env Received', JSON.stringify(process.env))
  console.log('projectId', process.env.projectId)
  console.log('instanceId', process.env.instanceId)
  console.log('GRAPH_TENANT_ID', process.env.GRAPH_TENANT_ID)
  console.log('GRAPH_CLIENT_ID', process.env.GRAPH_CLIENT_ID)
  console.log('GRAPH_CLIENT_SECRET', process.env.GRAPH_CLIENT_SECRET)
  console.log('GRAPH_SENDER_EMAIL', process.env.GRAPH_SENDER_EMAIL)

  try {
    // Authenticate with Google Cloud using service account credentials
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/sqlservice.admin']
    })

    const authClient = await auth.getClient()

    const sqlAdmin = google.sqladmin('v1beta4')

    const request = {
      project: process.env.projectId,
      instance: process.env.instanceId,
      auth: authClient
    }

    // Get a list of Cloud SQL instances
    const instances = await sqlAdmin.backupRuns.list(request)

    const backups = instances.data.items

    let emailBody = '<pre>'
    let cnt = 0

    if (backups) {
      backups.forEach(backup => {
        if (cnt < 1) {
          cnt++
          if (backup.status != 'SUCCESSFUL') {
            var obj = Object.assign(
              {
                severity: 'ALERT',
                message: `SQL Backup Failed for Instance ${process.env.instanceId}`
              },
              backup
            )
            console.log(JSON.stringify(obj))
          } else {
            var notice = Object.assign(
              {
                severity: 'NOTICE',
                message: `SQL Backup SUCCESSFUL for Instance ${process.env.instanceId}`
              },
              backup
            )
            console.log(JSON.stringify(notice))
          }
        }

        //generating Email Template
        var color = backup.status == 'SUCCESSFUL' ? 'green' : 'red'
        emailBody = emailBody + `<br/><br/>`
        emailBody = emailBody + `- <b>ID:${backup.id}</b><br/>`
        emailBody =
          emailBody +
          `  - Status : <span style="color:${color}">${backup.status}</span><br/>`
        emailBody =
          emailBody + `  - Description: ${(backup.description ??= '')}<br/>`
        emailBody = emailBody + `  - Backup Type: ${backup.kind}<br/>`
        emailBody = emailBody + `  - startTime: ${backup.startTime}<br/>`
        emailBody = emailBody + `  - endTime: ${backup.startTime}<br/>`

        // if (backup.status == "SUCCESSFUL") {
        //   console.log(backup);
        // }
      })

      emailBody = emailBody + `</pre>`

      var status = await email.sendEmail(
        process.env.ALERT_RCEIVER_EMAIL,
        `ALERT - Backup Check - Production DB  (${process.env.instanceId})`,
        emailBody
      )
    }

    res.status(200).send('Backup check - successfuly')
  } catch (err) {
    console.error(
      `Error fetching backups for instance : ${process.env.instanceId}`,
      err.message
    )
    res.status(200).send(`Error while processing - ${err.message}`)
  }
}

listCloudSqlBackups()

/*

const functions = require('@google-cloud/functions-framework');

// Register a CloudEvent callback with the Functions Framework that will
// be executed when the Pub/Sub trigger topic receives a message.
functions.cloudEvent('helloPubSub', cloudEvent => {
  // The Pub/Sub message is passed as the CloudEvent's data payload.
  const base64name = cloudEvent.data.message.data;

  const name = base64name
    ? Buffer.from(base64name, 'base64').toString()
    : 'World';

  console.log(`Hello, ${name}!`);
});

*/
