require('dotenv').config();
const bcrypt = require("bcryptjs");
const { sendCustomerCookie } = require('../utils/utilityFunctions')
const { User, createCompanyDb } = require('../models/user-models')
const accessToken = process.env.STORE_API_PASSWORD;
const url = process.env.STORE_GRAPHQL_URL;

const createCompany = async (req, res) => {
    const request = await req.body;
    request.customerEmail = request.customerEmail.toLowerCase();
    request.relationship = request.relationship.toLowerCase();
    request.firstName = request.firstName.toLowerCase();
    request.lastName = request.lastName.toLowerCase();

    let otherData = {}

    try {
        // Step 1: Check if the Customer Exists by Email
        const customerSearchQuery = `
            query findCustomerByEmail($query: String!) {
                customers(first: 1, query: $query) {
                    edges {
                        node {
                            id
                            email
                            firstName
                            lastName
                        }
                    }
                }
            }`;

        const searchVariables = {
            query: `email:${request.customerEmail}`
        };

        let response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ query: customerSearchQuery, variables: searchVariables })
        });

        let data = await response.json();

        let customerId;
        if (data.data.customers.edges.length > 0) {
            // Customer exists, retrieve customer ID
            const customer = data.data.customers.edges[0].node;
            customerId = customer.id;

            // Step 2: Check if First Name and Last Name are blank and update if necessary
            if (!customer.firstName || !customer.lastName) {
                const updateCustomerQuery = `
                    mutation updateCustomer($input: CustomerInput!) {
                        customerUpdate(input: $input) {
                            customer {
                                id
                                firstName
                                lastName
                            }
                            userErrors {
                                message
                                field
                            }
                        }
                    }`;

                const updateCustomerVariables = {
                    input: {
                        id: customerId,
                        firstName: customer.firstName || request.firstName,
                        lastName: customer.lastName || request.lastName
                    }
                };

                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': accessToken
                    },
                    body: JSON.stringify({ query: updateCustomerQuery, variables: updateCustomerVariables })
                });

                data = await response.json();

                if (data.errors) {
                    throw new Error(data.errors.map(e => e.message).join(', '));
                }
            }
        } else {
            // Customer does not exist, create a new one
            const customerCreateQuery = `
                mutation createCustomer($input: CustomerInput!) {
                    customerCreate(input: $input) {
                        customer {
                            id
                            email
                            firstName
                            lastName
                        }
                        userErrors {
                            message
                            field
                        }
                    }
                }`;

            const customerCreateVariables = {
                input: {
                    firstName: request.firstName,
                    lastName: request.lastName,
                    email: request.customerEmail,
                    metafields: [
                        {
                            namespace: "my_field",
                            key: "nickname",
                            type: "single_line_text_field",
                            value: request.firstName
                        }
                    ]
                }
            };

            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken
                },
                body: JSON.stringify({ query: customerCreateQuery, variables: customerCreateVariables })
            });

            data = await response.json();

            if (!data.data.customerCreate.customer) {
                throw new Error(data.data.customerCreate.userErrors.map(e => e.message).join(', '));
            }
            customerId = data.data.customerCreate.customer.id;
        }

        // Proceed with the previous company creation, linking customer, and assigning role logic
        // Step 1: Create Company and Fetch IDs
        const query1 = `
            mutation CompanyCreate($input: CompanyCreateInput!) {
                companyCreate(input: $input) {
                    company {
                        id
                        locations(first: 1) {
                            edges {
                                node {
                                    id
                                }
                            }
                        }
                        contactRoles(first: 1) {
                            edges {
                                node {
                                    id
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`;

        const customerNumId = customerId.match(/Customer\/(\d+)/)[1];
        const variables1 = {
            input: {
                company: {
                    name: request.firstName,
                    externalId: customerNumId
                },
                companyLocation: {
                    name: request.firstName,
                    shippingAddress: {
                        firstName: request.firstName,
                        lastName: request.lastName,
                        address1: "",
                        city: "",
                        zoneCode: "",
                        zip: "",
                        countryCode: request.countryCode
                    },
                    billingSameAsShipping: true
                }
            }
        };

        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ query: query1, variables: variables1 })
        });

        data = await response.json();

        if (!data.data || !data.data.companyCreate) {
            throw new Error(data.errors ? data.errors.map(e => e.message).join(', ') : 'Unknown error in creating company');
        }

        const company = data.data.companyCreate.company;
        if (!company) {
            throw new Error('Company creation failed. No company object returned.');
        }
        const locationEdge = company.locations.edges[0];
        if (!locationEdge) {
            throw new Error('No location returned for the company.');
        }
        const roleEdge = company.contactRoles.edges[0];
        if (!roleEdge) {
            throw new Error('No role returned for the company.');
        }

        const roleId = roleEdge.node.id;
        const companyId = company.id;
        const locationId = locationEdge.node.id;
        otherData.companyRoleId = roleId;
        otherData.companyId = companyId;
        otherData.locationId = locationId;

        // Step 2: Link Customer to Company
        const query2 = `
            mutation assignCustomerToCompany($companyId: ID!, $customerId: ID!) {
                companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
                    companyContact {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`;

        const variables2 = {
            companyId: companyId,
            customerId: customerId
        };

        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ query: query2, variables: variables2 })
        });

        data = await response.json();

        if (!data.data || !data.data.companyAssignCustomerAsContact) {
            if (data.errors) {
                console.error('API Errors:', data.errors);
                throw new Error(data.errors.map(e => e.message).join(', '));
            }
            if (data.data && data.data.companyAssignCustomerAsContact.userErrors.length > 0) {
                throw new Error(data.data.companyAssignCustomerAsContact.userErrors.map(e => e.message).join(', '));
            }
            throw new Error('Unknown error in linking customer');
        }

        const companyContact = data.data.companyAssignCustomerAsContact.companyContact;
        if (!companyContact) {
            throw new Error('Linking customer to company failed. No company contact returned.');
        }

        const companyContactId = companyContact.id;
        otherData.companyContactId = companyContactId;

        // Step 3: Assign Role to Company Contact
        const query3 = `
            mutation assignRoleToCompanyContact($companyContactId: ID!, $rolesToAssign: [CompanyContactRoleAssign!]!) {
                companyContactAssignRoles(companyContactId: $companyContactId, rolesToAssign: $rolesToAssign) {
                    roleAssignments {
                        role {
                            id
                            name
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`;

        const variables3 = {
            companyContactId: companyContactId,
            rolesToAssign: [
                {
                    companyContactRoleId: roleId,
                    companyLocationId: locationId
                }
            ]
        };

        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ query: query3, variables: variables3 })
        });

        data = await response.json();

        if (data.errors) {
            throw new Error(data.errors.map(e => e.message).join(', '));
        }

        // Assuming 'request' is your incoming object that includes the 'newsletter' field
        if (request.newsletter === "TRUE") {
            // Define the GraphQL query and variables for updating email marketing consent
            const marketingConsentQuery = `
                mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
                    customerEmailMarketingConsentUpdate(input: $input) {
                        customer {
                            id
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`;

            function convertNewsletterTime(unixTime) {
                // Convert unixTime from seconds to milliseconds
                const dateObj = new Date(request.newsletterTimestamp ? unixTime * 1000 : unixTime);

                // Get the date components in the 'America/New_York' timezone
                const options = {
                    timeZone: 'America/New_York',
                    hour12: false,
                    year: 'numeric',
                    month: '2-digit', // Ensures leading zeros
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                };

                const formatter = new Intl.DateTimeFormat('en-US', options);
                const parts = formatter.formatToParts(dateObj);

                const dateParts = {};
                parts.forEach(part => {
                    if (part.type !== 'literal') {
                        dateParts[part.type] = part.value;
                    }
                });

                // Extract and parse the date components
                const year = parseInt(dateParts.year, 10);
                const month = parseInt(dateParts.month, 10); 
                const day = parseInt(dateParts.day, 10);
                const hour = parseInt(dateParts.hour, 10);
                const minute = parseInt(dateParts.minute, 10); 
                const second = parseInt(dateParts.second, 10);
                const nyDateUTC = Date.UTC(year, month - 1, day, hour, minute, second);
                const utcDate = new Date(nyDateUTC);
                const formattedDate = utcDate.toISOString().split('.')[0] + 'Z';

                return formattedDate;
            }

            const newsletterTime = convertNewsletterTime(request.newsletterTimestamp ? Number(request.newsletterTimestamp) : Date.now());
            console.log(newsletterTime)
            const marketingConsentVariables = {
                input: {
                    customerId: customerId,
                    emailMarketingConsent: {
                        consentUpdatedAt: newsletterTime, 
                        marketingOptInLevel: "CONFIRMED_OPT_IN",
                        marketingState: "SUBSCRIBED"
                    }
                }
            };

            // Execute the GraphQL mutation using fetch
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken
                },
                body: JSON.stringify({ query: marketingConsentQuery, variables: marketingConsentVariables })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.errors) {
                        console.error('Error updating marketing consent:', data.errors);
                    } else {
                        console.log('Marketing consent updated successfully:', data.data.customerEmailMarketingConsentUpdate.customer);
                    }
                })
                .catch(error => {
                    console.error('Error sending request:', error);
                });
        }

        async function updateCustomerTags(customerId, newTag) {
            // Step 1: Fetch the customer's existing tags
            const getCustomerQuery = `
                query getCustomer($id: ID!) {
                    customer(id: $id) {
                        id
                        tags
                    }
                }`;

            const getCustomerVariables = {
                id: customerId
            };

            try {
                let response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': accessToken
                    },
                    body: JSON.stringify({
                        query: getCustomerQuery,
                        variables: getCustomerVariables
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch customer tags: ${response.statusText}`);
                }

                let data = await response.json();

                if (data.errors) {
                    throw new Error(data.errors.map(e => e.message).join(', '));
                }

                if (!data.data || !data.data.customer) {
                    throw new Error('Customer not found when fetching tags.');
                }

                const existingTags = data.data.customer.tags;

                // Step 2: Append the new tag if it's not already present
                if (!existingTags.includes(newTag)) {
                    existingTags.push(newTag);
                } else {
                    console.log(`Customer already has the tag '${newTag}'.`);
                    return; // No need to update if the tag already exists
                }

                // Step 3: Update the customer with the new tags
                const updateCustomerTagsQuery = `
                    mutation customerUpdate($input: CustomerInput!) {
                        customerUpdate(input: $input) {
                            customer {
                                id
                                tags
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }`;

                const updateCustomerTagsVariables = {
                    input: {
                        id: customerId,
                        tags: existingTags
                    }
                };

                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': accessToken
                    },
                    body: JSON.stringify({
                        query: updateCustomerTagsQuery,
                        variables: updateCustomerTagsVariables
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to update customer tags: ${response.statusText}`);
                }

                data = await response.json();

                if (data.errors) {
                    throw new Error(data.errors.map(e => e.message).join(', '));
                }

                if (data.data.customerUpdate.userErrors.length > 0) {
                    throw new Error(data.data.customerUpdate.userErrors.map(e => e.message).join(', '));
                }

                console.log('Customer tags updated successfully:', data.data.customerUpdate.customer.tags);

            } catch (error) {
                console.error('Error updating customer tags:', error);
                throw error; // Re-throw the error to be caught in the calling function
            }
        }

        await updateCustomerTags(customerId, 'bubble');

        let dbData = { ...request, ...otherData };
        const date = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatted = date.toLocaleDateString('en-CA', options);
        const initialData = {
            firstName: dbData.firstName,
            lastName: dbData.lastName,
            email: dbData.customerEmail,
            countryCode: dbData.countryCode,
            dueDate: dbData.dueDate,
            relationship: dbData.relationship,
            customerId: dbData.customerId,
            companyId: dbData.companyId,
            locationId: dbData.locationId,
            companyRoleId: dbData.companyRoleId,
            companyContactId: dbData.companyContactId,
            newsletter: dbData.newsletter,
            submittionDate: formatted,
        };
        const newEntry = new createCompanyDb(initialData);
        newEntry.save();
        request.customerCookie
            ? await sendCustomerCookie(request)
            : console.log('No customer cookie provided, skipping.');
        res.status(200).json({ message: 'company created', formData: dbData });

    } catch (error) {
        console.error('Error:', error);
    }
};

const companyStatus = async (req, res) => {
    const request = await req.body;
    try {
        const check = await createCompanyDb.findOne({ email: request.email });
        if (check != null) {
            res.status(401).json({ message: 'you are already subscribe, Please login', object: check });
        } else {
            res.status(200).json({ message: 'new email id' });
        }
    } catch (error) {
        return res.status(200).send({ message: 'error in checking email id', error: error })
    }
}

const updateCompany = async (req, res) => {
    let response = await req.body;
    try {
        const updatedEnquiry = await createCompanyDb.findByIdAndUpdate(
            response.id,
            {
                $set: {
                    relationship: response.relationship,
                    dueDate: response.due,
                }
            },
            { new: true, runValidators: true } // Options to return the updated document and run validation
        );
        if (!updatedEnquiry) {
            return res.status(404).json({ message: 'Enquiry not found' });
        }

        res.status(200).json({ message: 'Enquiry updated successfully' });
    } catch (error) {

    }
}

const getCustomer = async (req, res) => {
    try {
        let response = await createCompanyDb.find();
        if (!response) {
            return res.status(404).send({ message: 'no company found' })
        }
        return res.status(200).send(response)
    } catch (error) {
        return res.status(500).send({ message: 'error in fetching companies', error: error })
    }
}

const updateCustomer = async (req, res) => {
    try {
        const enquiryId = req.params.id;
        const updateData = req.body;
        const currentCustomer = await createCompanyDb.findByIdAndUpdate(
            enquiryId,
            {
                $set: {
                    dueDate: updateData.dueDate,
                    relationship: updateData.relationship,
                    comments: updateData.comments.map(comment => ({
                        comment_text: comment.comment_text,
                        comment_date: comment.comment_date
                    }))
                }
            },
            { new: true, runValidators: true } // Options to return the updated document and run validation
        );

        if (!currentCustomer) {
            return res.status(404).send('customer not found');
        }

        res.status(200).send('customer data updated successfully');
    } catch (error) {
        console.error('Error customer data:', error);
        res.status(500).send('Error updating customer data');
    }
}

const deleteMultipleCompanies = async (req, res) => {
    try {
        const companiesID = req.body.ids;
        if (!Array.isArray(companiesID) || companiesID.length === 0) {
            return res.status(400).send('Invalid or no IDs provided');
        }
        const result = await createCompanyDb.deleteMany({
            _id: { $in: companiesID }
        });
        if (result.deletedCount === 0) {
            return res.status(404).send('No enquiries found to delete');
        }
        return res.status(200).send(`${result.deletedCount} Company data deleted successfully`);
    } catch (error) {
        console.error('Error deleting company data:', error);
        res.status(500).send('Error deleting company data');
    }
}

const deleteCompany = async (req, res) => {
    try {
        const enquiryId = req.params.id;

        // Find the company document by its ID in MongoDB
        // const companyDoc = await createCompanyDb.findById(enquiryId);

        // if (!companyDoc) {
        //     return res.status(404).send('Company not found');
        // }

        // let shopifyCompanyId = companyDoc.companyId;

        // if (!shopifyCompanyId) {
        //     return res.status(400).send('Shopify company ID not found in company document');
        // }


        // if (!shopifyCompanyId.startsWith('gid://')) {
        //     shopifyCompanyId = `gid://shopify/Company/${shopifyCompanyId}`;
        // }

        // Define the GraphQL mutation for deleting a company in Shopify
        // const query = `
        //     mutation companyDelete($id: ID!) {
        //         companyDelete(id: $id) {
        //             deletedCompanyId
        //             userErrors {
        //                 field
        //                 message
        //             }
        //         }
        //     }`;

        // const variables = {
        //     id: shopifyCompanyId
        // };

        // Set up headers for the Shopify API request
        // const headers = {
        //     'Content-Type': 'application/json',
        //     'X-Shopify-Access-Token': accessToken
        // };

        // Make the API call to Shopify to delete the company
        // const response = await fetch(url, {
        //     method: 'POST',
        //     headers: headers,
        //     body: JSON.stringify({ query, variables })
        // });

        // if (!response.ok) {
        //     throw new Error(`Failed to delete company from Shopify: ${response.statusText}`);
        // }

        // const data = await response.json();

        // Handle any errors returned by Shopify
        // if (data.errors && data.errors.length > 0) {
        //     throw new Error(data.errors.map(e => e.message).join(', '));
        // }

        // if (data.data.companyDelete.userErrors && data.data.companyDelete.userErrors.length > 0) {
        //     const errorMessages = data.data.companyDelete.userErrors.map(e => e.message).join(', ');
        //     throw new Error(`Shopify error(s): ${errorMessages}`);
        // }

        // After successful deletion from Shopify, delete the company from MongoDB
        await createCompanyDb.findByIdAndDelete(enquiryId);

        res.status(200).send('Company data deleted successfully');
    } catch (error) {
        console.error('Error deleting company data:', error);
        res.status(500).send(`Error deleting company data: ${error.message}`);
    }
};

const userRegister = async (req, res) => {
    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(409).send("User already exists");
        }
        const newUser = new User({
            password: req.body.password,
            email: req.body.email
        });
        await newUser.save();
        return res.status(200).send("User registered")
    }
    catch (error) {
        console.error("Error:", error);
        return res.status(500).send("Internal server error");
    }
}

const userLogin = async (req, res) => {
    try {
        const userValid = await User.findOne({ email: req.body.email });
        if (userValid) {
            const detailsMatch = await bcrypt.compare(req.body.password, userValid.password)
            if (!detailsMatch) {
                return res.status(401).send("Invalid credentials");
            } else {

                const token = await userValid.generateToken();
                res.cookie("userCookie", token, {
                    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    httpOnly: true,
                    sameSite: "Lax",
                    secure: true
                });
                return res.status(200).send({ userValid })
            }

        } else {
            return res.status(404).send("User not found");
        }
    } catch (error) {
        return res.status(500).send(error)
    }
}

const validateUser = async (req, res) => {
    try {
        let user = await User.findOne({ _id: req.userId });
        res.status(200).send(user);
    } catch (error) {
        res.status(401).send("user not found");
    }
}

const logoutUser = async (req, res) => {
    try {
        res.clearCookie('userCookie');
        res.status(200).send({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(401).send({ message: 'error in Logged out' });
    }
}

const updatePassword = async (req, res) => {
    const { newPassword } = req.body;
    try {
        const user = req.validUser;
        user.password = newPassword;
        await user.save();
        res.status(200).send('Password updated successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error.');
    }
};


module.exports = { createCompany, companyStatus, updateCompany, getCustomer, updateCustomer, deleteMultipleCompanies, deleteCompany, validateUser, userLogin, userRegister, logoutUser, updatePassword }; 
