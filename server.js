const {SC_TICKETNG_ABI} = require('./sc-ticketing-abi.js');
const {SC_TICKETNG_ADDRESS, WS_ADDRESS} = require('./ticketing-contract-exo.js');
const Web3 = require('web3');

const transporterPrivateKey = process.env.PRIVATE_KEY;
const transporterPricePerSecond = process.env.PRICE_PER_SECOND;

if (!process.env.PRIVATE_KEY || !process.env.PRICE_PER_SECOND) {
    throw new Error("environment variables not set correctly");
}

// set up account and contract
let provider = new Web3.providers.WebsocketProvider(WS_ADDRESS);
let web3js_ws = new Web3(provider);

provider.on('error', e => {
    console.error('WS Infura Error', e);
});

provider.on('end', e => {
    console.log('WS closed');
    console.log('Attempting to reconnect...');
    provider = new Web3.providers.WebsocketProvider(WS_ADDRESS);
    provider.on('connect', function () {
        console.log('WSS Reconnected ', WS_ADDRESS);
    });
    web3js_ws.setProvider(provider);
});

// creating the account in web3js
account = web3js_ws.eth.accounts.privateKeyToAccount(transporterPrivateKey);
web3js_ws.eth.accounts.wallet.add(account);
web3js_ws.eth.defaultAccount = account.address;

let ticketing_contract = new web3js_ws.eth.Contract(SC_TICKETNG_ABI, SC_TICKETNG_ADDRESS);
console.log('Setup completed, waiting for events for transporter:', account.address);

// just a test - this works
// web3js_ws.eth.getBalance(account.address).then((balance) => {
//     console.log('Balance: ', Math.round(parseFloat(balance) / 10000000000000000) / 100);
// });


// just a test - this works
// ticketing_contract.methods.getTrips(
//         account.address,
//     ).call().then((data) => {
//         console.log('getTrips was a success: ', JSON.stringify(data));
//     }).catch((err) => {
//         console.log('getTrips Error: ', err.message);
//     });

// Listenting to the TripCreated event
// https://ethereum.stackexchange.com/questions/47362/how-to-listen-to-events-generated-by-an-existing-contract-in-web3-1-x-x
ticketing_contract.events.TripCreated().on('data', function (event) {
    console.log('TripCreated EVENT received:', JSON.stringify(event));
}).on('error', console.error);

ticketing_contract.events.CheckedOut().on('data', function (event) {

    if (account.address.toLowerCase() !== event.returnValues.transporter.toLowerCase()) {
        // SC also doesnt allow to write to a trip for another transporter
        console.log(account.address.toLowerCase() + ' doesnt match ' + event.returnValues.transporter.toLowerCase() + ' - this event is therefore dropped.');
        return;
    }

    console.log('CheckedOut EVENT received:', JSON.stringify(event));

    // get trip data
    const trip = event.returnValues;

    console.log('processing trip: ', trip);

    // get trip start and end date
    const start = new Date(parseInt(trip.startTimestamp));
    const end = new Date(parseInt(trip.endTimestamp));
    const passengerAddress = trip.passenger;

    console.log('START: ', start);
    console.log('END: ', end);

    // calculate seconds
    const seconds = +((end.getTime() - start.getTime()) / 1000).toFixed(2);
    console.log('Trip duration in seconds:', seconds);

    // calculate  price
    const price = transporterPricePerSecond * seconds;
    console.log('Trip price:', price);

    // send price to SC
    ticketing_contract.methods.setPrice(
        passengerAddress,
        price * 100000000000000000,
        trip.startTimestamp,
    ).send({
        'from': account.address,
        'gas': 3000000,
    }).then((data) => {
        console.log('Setting price was a success: ', JSON.stringify(data));
    }).catch((err) => {
        console.log('Error while setting price: ', err.message);
    });

}).on('error', console.error);
