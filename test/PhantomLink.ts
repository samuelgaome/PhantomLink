import { TextDecoder, TextEncoder } from "util";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { PhantomLink, PhantomLink__factory } from "../types";

type Signers = {
  sender: HardhatEthersSigner;
  recipient: HardhatEthersSigner;
  observer: HardhatEthersSigner;
};

function encryptWithAddress(message: string, address: string): string {
  const normalized = ethers.getAddress(address).toLowerCase();
  const key = ethers.keccak256(ethers.toUtf8Bytes(normalized));
  const keyBytes = ethers.getBytes(key);
  const messageBytes = new TextEncoder().encode(message);
  const encrypted = messageBytes.map((value, idx) => value ^ keyBytes[idx % keyBytes.length]);
  return Buffer.from(encrypted).toString("base64");
}

function decryptWithAddress(ciphertext: string, address: string): string {
  const normalized = ethers.getAddress(address).toLowerCase();
  const key = ethers.keccak256(ethers.toUtf8Bytes(normalized));
  const keyBytes = ethers.getBytes(key);
  const encryptedBytes = Uint8Array.from(Buffer.from(ciphertext, "base64"));
  const decrypted = encryptedBytes.map((value, idx) => value ^ keyBytes[idx % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PhantomLink")) as PhantomLink__factory;
  const contract = (await factory.deploy()) as PhantomLink;
  const address = await contract.getAddress();

  return { contract, address };
}

describe("PhantomLink", function () {
  let signers: Signers;
  let messenger: PhantomLink;
  let messengerAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      sender: ethSigners[0],
      recipient: ethSigners[1],
      observer: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract: messenger, address: messengerAddress } = await deployFixture());
  });

  it("stores an encrypted message and lets the recipient decrypt the key", async function () {
    const message = "Secret hello across PhantomLink";
    const ephemeral = ethers.Wallet.createRandom();
    const ciphertext = encryptWithAddress(message, ephemeral.address);

    const encryptedAddress = await fhevm
      .createEncryptedInput(messengerAddress, signers.sender.address)
      .addAddress(ephemeral.address)
      .encrypt();

    const tx = await messenger
      .connect(signers.sender)
      .sendMessage(signers.recipient.address, ciphertext, encryptedAddress.handles[0], encryptedAddress.inputProof);
    await tx.wait();

    const count = await messenger.messageCount(signers.recipient.address);
    expect(count).to.eq(1n);

    const stored = await messenger.getMessage(signers.recipient.address, 0);
    expect(stored[0]).to.eq(signers.sender.address);
    expect(stored[1]).to.eq(ciphertext);
    expect(stored[3]).to.be.greaterThan(0);

    const decryptedAddress = await fhevm.userDecryptEaddress(stored[2], messengerAddress, signers.recipient);
    expect(decryptedAddress.toLowerCase()).to.eq(ephemeral.address.toLowerCase());

    const clear = decryptWithAddress(stored[1], decryptedAddress);
    expect(clear).to.eq(message);
  });

  it("allows the inbox owner to share a message key", async function () {
    const message = "share with observer";
    const ephemeral = ethers.Wallet.createRandom();
    const ciphertext = encryptWithAddress(message, ephemeral.address);

    const encryptedAddress = await fhevm
      .createEncryptedInput(messengerAddress, signers.sender.address)
      .addAddress(ephemeral.address)
      .encrypt();

    const tx = await messenger
      .connect(signers.sender)
      .sendMessage(signers.recipient.address, ciphertext, encryptedAddress.handles[0], encryptedAddress.inputProof);
    await tx.wait();

    await messenger
      .connect(signers.recipient)
      .allowMessageKey(signers.recipient.address, 0, signers.observer.address);

    const stored = await messenger.getMessage(signers.recipient.address, 0);
    const decryptedAddress = await fhevm.userDecryptEaddress(stored[2], messengerAddress, signers.observer);

    const clear = decryptWithAddress(stored[1], decryptedAddress);
    expect(clear).to.eq(message);
  });

  it("validates recipients and message content", async function () {
    const encryptedAddress = await fhevm
      .createEncryptedInput(messengerAddress, signers.sender.address)
      .addAddress(signers.sender.address)
      .encrypt();

    await expect(
      messenger
        .connect(signers.sender)
        .sendMessage(ethers.ZeroAddress, "bad", encryptedAddress.handles[0], encryptedAddress.inputProof),
    ).to.be.revertedWith("Invalid recipient");

    await expect(
      messenger
        .connect(signers.sender)
        .sendMessage(signers.recipient.address, "", encryptedAddress.handles[0], encryptedAddress.inputProof),
    ).to.be.revertedWith("Empty message");
  });
});
