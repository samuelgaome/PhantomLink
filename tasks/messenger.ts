import { TextEncoder } from "util";
import { ethers } from "ethers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const CONTRACT_NAME = "PhantomLink";

function encryptWithAddress(message: string, address: string): string {
  const normalized = ethers.getAddress(address).toLowerCase();
  const key = ethers.keccak256(ethers.toUtf8Bytes(normalized));
  const keyBytes = ethers.getBytes(key);
  const messageBytes = new TextEncoder().encode(message);
  const encrypted = messageBytes.map((value, idx) => value ^ keyBytes[idx % keyBytes.length]);
  return Buffer.from(encrypted).toString("base64");
}

task("task:address", "Prints the PhantomLink address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const deployment = await hre.deployments.get(CONTRACT_NAME);
  console.log(`${CONTRACT_NAME} address is ${deployment.address}`);
});

task("task:send-message", "Sends an encrypted message")
  .addParam("to", "Recipient address")
  .addParam("message", "Message to encrypt and send")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    await hre.fhevm.initializeCLIApi();

    const deployment = await hre.deployments.get(CONTRACT_NAME);
    const [signer] = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const recipient = ethers.getAddress(taskArguments.to);
    const ephemeral = ethers.Wallet.createRandom();
    const ciphertext = encryptWithAddress(taskArguments.message, ephemeral.address);

    const encryptedAddress = await hre.fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(ephemeral.address)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .sendMessage(recipient, ciphertext, encryptedAddress.handles[0], encryptedAddress.inputProof);
    console.log(`Sent tx ${tx.hash}, waiting...`);
    await tx.wait();
    console.log(
      `Message sent to ${recipient} with ephemeral ${ephemeral.address}. Ciphertext: ${ciphertext.substring(0, 18)}...`,
    );
  });

task("task:get-message", "Reads a message from a user's inbox")
  .addParam("user", "Inbox owner")
  .addParam("index", "Message index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    await hre.fhevm.initializeCLIApi();

    const deployment = await hre.deployments.get(CONTRACT_NAME);
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);
    const index = parseInt(taskArguments.index);
    if (!Number.isInteger(index)) {
      throw new Error("Invalid index");
    }

    const [sender, encryptedMessage, encryptedKey, timestamp] = await contract.getMessage(
      taskArguments.user,
      index,
    );

    console.log(`Message ${index} for ${taskArguments.user}`);
    console.log(`- sender: ${sender}`);
    console.log(`- ciphertext: ${encryptedMessage}`);
    console.log(`- key handle: ${encryptedKey}`);
    console.log(`- timestamp: ${timestamp.toString()}`);
  });

task("task:count", "Shows inbox size for a user")
  .addParam("user", "Inbox owner")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const deployment = await hre.deployments.get(CONTRACT_NAME);
    const contract = await hre.ethers.getContractAt(CONTRACT_NAME, deployment.address);
    const count = await contract.messageCount(taskArguments.user);
    console.log(`Inbox size for ${taskArguments.user}: ${count.toString()}`);
  });
