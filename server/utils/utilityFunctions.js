require("dotenv").config();
const axios = require("axios");

// Function to send customer cookie data
async function sendCustomerCookie(formObject) {
  try {
    const {
      firstName,
      lastName,
      customerEmail,
      dueDate,
      relationship,
      newsletter,
      customerCookie,
    } = formObject;
    const apiKeyId = process.env.EXPONEA_API_KEY;
    const apiSecret = process.env.EXPONEA_API_SECRET;
    const projectId = process.env.EXPONEA_PROJECT_ID;

    const url = `https://api.uk.exponea.com/track/v2/projects/${projectId}/batch`;

    const base64Credentials = Buffer.from(`${apiKeyId}:${apiSecret}`).toString(
      "base64"
    );

    const bodyData = {
      commands: [
        {
          name: "customers/events",
          data: {
            event_type: "member",
            customer_ids: {
              email_id: customerEmail,
              cookie: customerCookie,
            },
            properties: {
              first_name: firstName,
              last_name: lastName,
              relationship: relationship,
              birth_or_due_date: dueDate,
              marketing_consent: newsletter === "TRUE" ? "accept" : "reject",
            },
          },
        },
        {
          name: "customers",
          data: {
            customer_ids: {
              email_id: customerEmail,
              cookie: customerCookie,
            },
            properties: {
              relationship: relationship,
              birth_or_due_date: dueDate,
            },
          },
        },
      ],
    };

    const response = await axios.post(url, JSON.stringify(bodyData), {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        "Content-Type": "application/json",
      },
    });

    console.log("API Response:", response.data);
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Failed to send customer data");
  }
}

async function sendCustomerCookieViaOmni(formObject) {
  try {
    const {
      firstName,
      lastName,
      customerEmail,
      dueDate,
      relationship,
      newsletter,
      customerCookie,
    } = formObject;
    const url = process.env.OMNI_WEBHOOK_URL;
    const bodyData = {
      commands: [
        {
          name: "customers/events",
          data: {
            event_type: "member",
            customer_ids: {
              email_id: customerEmail,
              cookie: customerCookie,
            },
            properties: {
              first_name: firstName,
              last_name: lastName,
              relationship: relationship,
              birth_or_due_date: dueDate,
              marketing_consent: newsletter === "TRUE" ? "accept" : "reject",
            },
          },
        },
        {
          name: "customers",
          data: {
            customer_ids: {
              email_id: customerEmail,
              cookie: customerCookie,
            },
            properties: {
              relationship: relationship,
              birth_or_due_date: dueDate,
            },
          },
        },
      ],
    };

    const response = await axios.post(url,bodyData,{
        headers:{
            "Content-Type":"application/json"
        }
    });

    console.log('Omni webhook response',response.status)
  } catch (error) {
    console.log('error in calling omni webhook',error)
  }
}

module.exports = { sendCustomerCookie, sendCustomerCookieViaOmni };
