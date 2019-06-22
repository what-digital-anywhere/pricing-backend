const {SC_TICKETNG_ABI} = require('./sc-ticketing-abi.js');
const {SC_TICKETNG_ADDRESS, WS_ADDRESS} = require('./ticketing-contract-exo.js');
const Web3 = require('web3');

const transporterPrivateKey = process.env.PRIVATE_KEY;
const transporterPricePerMinute = process.env.PRICE_PER_MINUTE;

if (!process.env.PRIVATE_KEY || !process.env.PRICE_PER_MINUTE) {
    throw new Error("environment variables not set correctly");
}

// set up account and contract
let web3js_ws = new Web3(new Web3.providers.WebsocketProvider(WS_ADDRESS));
account = web3js_ws.eth.accounts.privateKeyToAccount(transporterPrivateKey);
web3js_ws.eth.defaultAccount = account.address;
let ticketing_contract = new web3js_ws.eth.Contract(SC_TICKETNG_ABI, SC_TICKETNG_ADDRESS);
console.log('Setup completed, waiting for events for transporter:', account.address);

web3js_ws.eth.getBalance(account.address).then((balance) => {
    console.log('Balance: ', Math.round(parseFloat(balance) / 10000000000000000) / 100);
});

// ticketing_contract.methods.getTrips(
//         account.address,
//     ).send({
//         'from': account.address,
//         'gas': 3000000,
//     }).then((data) => {
//         console.log('getTrips was a success: ', JSON.stringify(data));
//     }).catch((err) => {
//         console.log('getTrips Error: ', err.message);
//     });

// Listenting to the TripCreated event
// https://ethereum.stackexchange.com/questions/47362/how-to-listen-to-events-generated-by-an-existing-contract-in-web3-1-x-x


ticketing_contract.events.TripCreated((err, event) => {
    console.log('TripCreated EVENT received:', err, JSON.stringify(event));
});

ticketing_contract.events.CheckedOut((err, event) => {
// ticketing_contract.events.CheckedOut((err, event) => {

    // if (account.address.toLowerCase() !== event.returnValues.transporter.toLowerCase()) {
    //     // SC also doesnt allow to write to a trip for another transporter
    //     console.log(account.address.toLowerCase() + ' doesnt match ' + event.returnValues.transporter.toLowerCase() + ' - this event is therefore dropped.');
    //     return;
    // }

    console.log('CheckedOut EVENT received:', err, JSON.stringify(event));

    // get trip data
    const trip = event.returnValues;

    // get trip start and end date
    const start = new Date(trip.startTimestamp.toNumber() * 1000);
    const end = new Date(trip.endTimestamp.toNumber() * 1000);
    const passengerAddress = trip.passenger;

    // calculate minutes
    const minutes = Math.round((((end - start) % 86400000) % 3600000) / 60000);
    console.log('Trip duration in min:', minutes);

    // calculate  price
    const price = transporterPricePerMinute * minutes;
    console.log('Trip price:', price);

    // send price to SC
    ticketing_contract.methods.setPrice(
        passengerAddress,
        price,
        trip.endTimestamp,
    ).send({
        'from': account.address,
        'gas': 3000000,
    }).then((data) => {
        console.log('Setting price was a success: ', JSON.stringify(data));
    }).catch((err) => {
        console.log('Error while setting price: ', err.message);
    });

});
