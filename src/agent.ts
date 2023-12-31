import {
  BlockEvent,
  Finding,
  Initialize,
  HandleBlock,
  HandleTransaction,
  HandleAlert,
  AlertEvent,
  TransactionEvent,
  FindingSeverity,
  FindingType,
  ethers,
} from "forta-agent";
import axios from 'axios';
import Web3 from "web3";
import db from "./db";
import util from "util";
// import { getFlashloans as getFlashloansFn } from "./flashloan-detector";
// import helperModule from "./helper";
// import { PersistenceHelper } from "./persistence.helper";

export const ERC20_TRANSFER_EVENT =
  "event Transfer(address indexed from, address indexed to, uint256 value)";
// export const TETHER_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const TETHER_DECIMALS = 6;
let findingsCount = 0;
let validAddress: string[] = [];

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];
  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  // if (findingsCount >= 5) return findings;
  if (!txEvent.logs.length) return findings;
  // filter the transaction logs for Tether transfer events
  const protocol = txEvent.network;
  const blockNumber = txEvent.blockNumber;
  const timeStamp = txEvent.timestamp;
  const hash = txEvent.hash;
  console.log(protocol, '------protocol----')
  // console.log(protocol, '-------tr event----------', blockNumber, '-------', timeStamp, '------', hash)
  const tetherTransferEvents = txEvent.filterLog(
    ERC20_TRANSFER_EVENT,
    // ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F", "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "0x6982508145454Ce325dDbE47a25d4ec3d2311933", "0x3845badAde8e6dFF049820680d1F14bD3903a5d0", "0x0000000000085d4780B73119b644AE5ecd22b376","0x514910771AF9Ca656af840dff83E8264EcF986CA", "0x0D8775F648430679A709E98d2b0Cb6250d2887EF", "0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074", "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e", "0x799a4202c12ca952cB311598a024C80eD371a41e", "0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55", "0xc00e94Cb662C3520282E6f5717214004A7f26888", "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", "0x55d398326f99059fF775485246999027B3197955", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", "0x4B0F1812e5Df2A09796481Ff14017e6005508003", "0xD41FDb03Ba84762dD66a0af1a6C8540FF1ba5dfb", "0x1F1C90aEb2fd13EA972F0a71e35c0753848e3DB0", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", "0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787", "0x9A2f5556e9A637e8fBcE886d8e3cf8b316a1D8a2", "0xCD392021084683803525FE5E6c00cAe9C6bE5774", "0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A","0x64619f611248256F7F4b72fE83872F89d5d60d64", "0x98f8669F6481EbB341B522fCD3663f79A3d1A6A7"]
  );
  const updatedAddress: string[] = [];
  tetherTransferEvents.forEach(async (transferEvent: any) => {
   
  //   // extract transfer event arguments
    const { to, from, value } = transferEvent.args;
    const address = transferEvent.address;
    console.log(validAddress, '--------valid address----')
    if (updatedAddress.includes(address) || !validAddress.includes(address)) return;
    updatedAddress.push(address)
    let url = `https://api.etherscan.io/api?module=account&action=txlist&address=${from}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=IFHFS4XF4RGGW4F99FHIQG2AJF7AV6IW2D`;
    if (protocol !== 1) url = `https://api.bscscan.com/api?module=account&action=txlist&address=${from}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=VRWQ7X5FHH3X38IDB5VJB2Z69A46849CYH`;
    const firstRecord = await axios.get(url)
    const firstIn = firstRecord?.data?.result && firstRecord.data.result.length ? firstRecord.data.result[0].timeStamp : '0';
    if (firstIn) {
      const datediff = (first: any, second: any)  => {   
        return Math.round((first - second) / (60 * 60 * 24));
      }
      const diff = datediff(Math.round(Date.now()/1000), firstIn);
      let message = '';
      let type = 'Wallet';
      if (diff <= 1) {
          message = `New Wallet interacted between age 1 hr-24 hours. Check Address`;
      } else if (diff <=7) {
          message = `New Wallet interacted between age 1 day-7 days. Check Address`;
      } else if (diff <=30) {
          message = `New Wallet interacted between age 7 days - 30 days. Check Address`;
      }
      if (!message) {
        const security = await axios.get(`https://api.gopluslabs.io/api/v1/address_security/${from}?chain_id=${protocol}`)
        if (security?.data?.result?.sanctioned && security.data.result.sanctioned !== '0') {
            message = `Sanctioned Wallet interacted. Check Address`;
        }
        if (security?.data?.result?.money_laundering && security.data.result.money_laundering !== '0') {
            message = `AML Wallet interacted. Check Address`;
        }
      }
      if (!message) {
        let tokensupplyUrl = `https://api.etherscan.io/api?module=stats&action=tokensupply&contractaddress=${address}&apikey=IFHFS4XF4RGGW4F99FHIQG2AJF7AV6IW2D`;
        if (protocol !== 1) tokensupplyUrl = `https://api.bscscan.com/api?module=stats&action=tokensupply&contractaddress=${address}&apikey=VRWQ7X5FHH3X38IDB5VJB2Z69A46849CYH`;
        const tokenSupply = await axios.get(tokensupplyUrl)
        if (tokenSupply?.data?.result) {
          const percent = value.div(ethers.BigNumber.from(tokenSupply?.data?.result)).mul(100)
          if (parseFloat(Web3.utils.fromWei(percent, "ether" )) > 1) {
            message = `More than 1% of total supply`
          }
        }
      }
      if (message) {
        const responseData = {
          name: "New Wallet interacted",
          description: message,
          alertId: "FORTA-1",
          severity: FindingSeverity.Low,
          type: FindingType.Info,
          metadata: {
            to,
            from,
            address,
            type,
            blockNumber: blockNumber.toString(),
            timeStamp: timeStamp.toString(),
            hash
          },
        };
        // findings.push(
        //   Finding.fromObject(responseData)
        // );
        try {
          await axios.post(`http://dashboard.dehack.ai:12000/api/webhook`, Finding.fromObject(responseData));
          // await axios.post(`http://localhost:12000/api/webhook`, Finding.fromObject(responseData));
        } catch(e) {
          console.log(e, '----err-----')
        }
        findingsCount++;
      }
    }
  });
  // console.log(findings, '------f----------')
  return findings;
};

// const initialize: Initialize = async () => {
//   // do some initialization on startup e.g. fetch data
// }

const handleBlock: HandleBlock = async (blockEvent: BlockEvent) => {
  const findings: Finding[] = [];
  // detect some block condition
  const query = util.promisify(db.query).bind(db);
  const result = await query("SELECT contractAddress FROM contracts WHERE chain='ETH'");
  validAddress = result.map((address: any)=>address.contractAddress)
  return findings;
}

// const handleAlert: HandleAlert = async (alertEvent: AlertEvent) => {
//   const findings: Finding[] = [];
//   // detect some alert condition
//   return findings;
// }

export default {
  // initialize,
  handleTransaction,
  handleBlock,
  // handleAlert
};
