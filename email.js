const axios = require("axios");

class Emailer {
  constructor() {
    this.tenantId = process.env.GRAPH_TENANT_ID;
    this.clientId = process.env.GRAPH_CLIENT_ID;
    this.clientSecret = process.env.GRAPH_CLIENT_SECRET;
    this.senderEmail = process.env.GRAPH_SENDER_EMAIL;
    this.accessToken = null;
    this.expiresAt = null;

    if (!Emailer.instance) {
      Emailer.instance = this;
    }

    // eslint-disable-next-line no-constructor-return
    return Emailer.instance;
  }

  async getToken() {
    if (!this.accessToken || new Date() >= this.expiresAt) {
      try {
        const response = await axios.post(
          `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
          `client_id=${this.clientId}` +
            "&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default" +
            `&client_secret=${this.clientSecret}` +
            "&grant_type=client_credentials",
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        this.accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in * 1000; // Convert seconds to milliseconds
        this.expiresAt = new Date().getTime() + expiresIn - 10000;
      } catch (error) {
        const errorMessage = error.response.data || error.message;
        console.error(errorMessage);
        throw Error(error);
      }
    }

    return this.accessToken;
  }

  #processEmail(emails) {
    const emailArray = [];
    const arrayOfEmails = emails.split(",");

    for (let i = 0; i < arrayOfEmails.length; i += 1) {
      const obj = {
        emailAddress: {
          address: arrayOfEmails[i],
        },
      };
      emailArray.push(obj);
    }

    return emailArray;
  }

  async sendEmail(toEmail, subject, template) {
    try {
      const accessToken = await this.getToken();
      const apiUrl = `https://graph.microsoft.com/v1.0/users/${this.senderEmail}/sendMail`;
      const addresses = this.#processEmail(toEmail);

      const response = await axios.post(
        apiUrl,
        {
          message: {
            subject,
            body: {
              contentType: "HTML",
              content: template,
            },
            toRecipients: addresses,
          },
          saveToSentItems: "false",
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      const errorMessage = error?.response?.data || error?.message;
      console.error(errorMessage);
      return errorMessage;
    }
  }
}

const emailer = new Emailer();
module.exports = emailer;
