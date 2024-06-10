const axios = require('axios');
const qs = require('qs');
const csv = require('csvtojson');
const fs = require('fs');
const fsPromise = require('fs').promises;
require('dotenv').config();

// Salesforce credentials
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const securityToken = process.env.SECURITY_TOKEN;
const salesOrg = process.env.SALESORG;

// Constants - urls, etc.
const loginUrl = process.env.LOGIN_URL
const instanceUrl = process.env.INSTANCE_URL;
//const queryUrl = instanceUrl + '/services/data/v52.0/query';
const csvPayments = './input/paymentsIds.csv';
const outputPathResults = './output/results.csv';
const outputPathPayments = './output/payments.csv';

async function getAccessToken() {
    try {
        let passToken = password;
        
        if (securityToken){
            passToken = password+securityToken;
        }
       
        const response = await axios.post(
            `${loginUrl}/services/oauth2/token`,
            qs.stringify({
            grant_type: 'password',
            client_id: clientId,
            client_secret: clientSecret,
            username: username,
            password: passToken
            }),
            {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
      );
  
      if (response && response.data) {
        return response.data.access_token;
      } else {
        throw new Error('Invalid response while getting access token');
      }
    } catch (error) {
      console.error('Error getting access token:', error.response ? error.response.data : error.message);
      throw new Error('Failed to get access token');
    }
}

// Access the REST API
async function getPayment(instanceUrl, accessToken, paymentid, salesOrg) {
	const queryUrl = instanceUrl + '/api/v61.0/payments/' + paymentid + '/aggregation?salesorg=' + salesOrg;
	//const queryUrl = instanceUrl + '/api';
	const response = await axios.get(
	queryUrl, 
	{	
		headers: {
		Authorization: `Bearer ${accessToken}`
		}
	}
	);
	return response.data;
    
}

// Function to convert CSV to JSON
async function writeFile(filePath, data) {
	await fsPromise.writeFile(filePath, data);
}

// Get output line format
function getOutputLine (paymentid, item){
    return paymentid + ',' + item.paymenttacticid + ',' + item.tacticid + ',' + item.productid + ',' + item.measurecode  + ',' + item.value
}

const main = async () => {
    let results = [];
    let payments = [];
    
    console.log('Logging as ' + username);
    const accessToken = await getAccessToken();
    //console.log('User logged in: ' + accessToken);

    // read the input file
    const jsonPropotionsIds = await csv().fromFile(csvPayments);

    // start results file
    results.push('paymentId,status');
    payments.push('paymentid,paymenttacticid,tacticid,productid,measurecode,value');

    for (const item of jsonPropotionsIds){
        console.log('Getting data for ' + item.paymentId);
        try {
            const payment = await getPayment(instanceUrl,accessToken,item.paymentId, salesOrg);
            for (const m of payment.measures){
                payments.push(getOutputLine(item.paymentId, m));
            }
            results.push(item.paymentId + ',OK');
            //payments.push(payment);            
        }
        catch(error){
            results.push(item.paymentId + ',' + error.message);
            console.log(error.stack)     
        }
    }

	await writeFile(outputPathResults, payments.join('\r\n'));
	await writeFile(outputPathPayments, results.join('\r\n'));
	console.log('============END============');
}

main().catch((err) => {
	console.error('Error in main execution:', err.stack);
});