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
} from "forta-agent";
import axios from 'axios';

export const ERC20_TRANSFER_EVENT =
  "event Transfer(address indexed from, address indexed to, uint256 value)";
// export const TETHER_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const TETHER_DECIMALS = 6;
let findingsCount = 0;

const handleTransaction: HandleTransaction = async (
  txEvent: TransactionEvent
) => {
  const findings: Finding[] = [];

  // limiting this agent to emit only 5 findings so that the alert feed is not spammed
  if (findingsCount >= 5) return findings;
  // filter the transaction logs for Tether transfer events
  const tetherTransferEvents = txEvent.filterLog(
    ERC20_TRANSFER_EVENT
  );

  tetherTransferEvents.forEach(async (transferEvent) => {
    // extract transfer event arguments
    const { to, from, value } = transferEvent.args;
    console.log(from, '-----from-------')
    const firstRecord = await axios.get(`https://api.etherscan.io/api?module=account&action=txlist&address=${from}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=IFHFS4XF4RGGW4F99FHIQG2AJF7AV6IW2D`)
    const firstIn = firstRecord?.data?.result && firstRecord.data.result.length ? firstRecord.data.result[0].timeStamp : '0';
    if (firstIn) {
      console.log(firstIn, "------------Wallet Age-----------------------");
      const datediff = (first: any, second: any)  => {   
        return Math.round((first - second) / (60 * 60 * 24));
      }
      const diff = datediff(Math.round(Date.now()/1000), firstIn)
      console.log(diff, '------diff------')
      let message = '';
      let type = 'Wallet';
      if (diff <= 1) {
          message = `New Wallet interacted between age 1 hr-24 hours. Check Address`;
      } else if (diff <=7) {
          message = `New Wallet interacted between age 1 day-7 days. Check Address`;
      } else if (diff <=30) {
          message = `New Wallet interacted between age 7 days - 30 days. Check Address`;
      }
      if (message) {
        findings.push(
          Finding.fromObject({
            name: "New Wallet interacted",
            description: message,
            alertId: "FORTA-1",
            severity: FindingSeverity.Low,
            type: FindingType.Info,
            metadata: {
              to,
              from,
            },
          })
        );
        findingsCount++;
      }
    }
  });

  return findings;
};

// const initialize: Initialize = async () => {
//   // do some initialization on startup e.g. fetch data
// }

// const handleBlock: HandleBlock = async (blockEvent: BlockEvent) => {
//   const findings: Finding[] = [];
//   // detect some block condition
//   return findings;
// }

// const handleAlert: HandleAlert = async (alertEvent: AlertEvent) => {
//   const findings: Finding[] = [];
//   // detect some alert condition
//   return findings;
// }

export default {
  // initialize,
  handleTransaction,
  // handleBlock,
  // handleAlert
};
