# PhantomLink

PhantomLink is an encrypted messaging dApp that hides the decryption key with Zama FHE so only authorized users can
reveal it. Senders encrypt a message with a fresh ephemeral EVM address, and the contract stores that address as a
fully-homomorphically encrypted key handle. Recipients decrypt the key via Zama, then decrypt the message locally.

## Overview

PhantomLink delivers private, recipient-controlled messages on-chain without ever revealing the decryption key in
plaintext. It blends symmetric-style encryption derived from an ephemeral address with FHE-protected key storage,
allowing messages to live on-chain while keeping the key private.

## Problems This Solves

- Public blockchains leak message content and keys by default.
- Traditional encryption still exposes keys in off-chain channels or centralized servers.
- Recipients need verifiable access controls for message keys without sharing secrets publicly.

## Key Advantages

- Ephemeral key per message: each message gets a fresh EVM address used as the encryption key.
- FHE-protected key: the ephemeral address is stored in encrypted form, only decryptable by authorized users.
- On-chain inbox: messages are indexed, queryable, and timestamped directly on-chain.
- Sender or recipient can grant access to the key using contract-enforced permissions.
- Frontend uses ethers for writes and viem for reads for clarity and separation of concerns.
- No local storage and no frontend environment variables, reducing persistence and configuration leaks.

## How It Works

1. The sender creates a new ephemeral EVM address A.
2. The sender encrypts the message with a key derived from A.
3. The sender FHE-encrypts A via the Zama relayer and submits:
   - recipient address
   - ciphertext message
   - encrypted address handle + proof
4. The contract stores the ciphertext and encrypted key in the recipient inbox.
5. The recipient decrypts the encrypted address A via Zama.
6. The recipient decrypts the message locally using A.

## Architecture

- Smart contract: stores ciphertext and encrypted key handles, enforces key-sharing permissions.
- Zama relayer: encrypts and decrypts the ephemeral key using FHEVM.
- Frontend: wallet connection, message composition, inbox display, decrypt workflow.
- CLI tasks: quick message send, message read, and inbox count for testing.

## Tech Stack

- Contracts: Solidity 0.8.x with Zama FHEVM libraries
- Framework: Hardhat + hardhat-deploy + TypeChain
- Frontend: React + Vite + TypeScript
- Wallet: RainbowKit + Ethers (write) + viem (read)
- Node and package manager: Node.js 20+, npm

## Repository Structure

```
contracts/              Smart contracts
deploy/                 Hardhat deploy scripts
deployments/            Deployment artifacts (ABI, addresses)
docs/                   Zama guides and relayer docs
tasks/                  Hardhat CLI tasks
test/                   Contract tests
src/                    Frontend app (React + Vite)
hardhat.config.ts       Hardhat configuration
```

## Smart Contract Details

Contract: `PhantomLink`

- `sendMessage(recipient, encryptedContent, encryptedKeyHandle, inputProof)`
  - Stores the ciphertext and FHE-protected key.
  - Grants access to the key to the sender, recipient, and contract.
- `messageCount(user)`
  - Returns inbox size for a user.
- `getMessage(user, index)`
  - Returns sender, ciphertext, encrypted key handle, and timestamp.
- `allowMessageKey(user, index, reader)`
  - Grants an additional reader access to the encrypted key.

## Frontend Features

- Wallet connection with RainbowKit
- Compose and send encrypted messages
- Inbox list with timestamps and senders
- Decrypt flow: decrypt key with Zama, then decrypt message locally
- Ethers for write calls, viem for read calls
- No Tailwind, no local storage, no frontend environment variables, and no JSON config files
- Designed for Sepolia, not localhost networks

## Prerequisites

- Node.js 20+
- npm
- Funded Sepolia account for deployment
- `INFURA_API_KEY` and `PRIVATE_KEY` configured in `.env`

## Configuration

Backend configuration is read from `.env` in the repo root:

```
INFURA_API_KEY=...
PRIVATE_KEY=...
ETHERSCAN_API_KEY=...        # optional
REPORT_GAS=1                 # optional
```

Notes:
- Deployment uses `PRIVATE_KEY`. Do not use a mnemonic.
- The frontend must not read environment variables.

## Install Dependencies

Root (contracts and tasks):

```bash
npm install
```

Frontend:

```bash
cd src
npm install
```

## Compile and Test

```bash
npm run compile
npm run test
```

## Local Development (Contracts Only)

```bash
npx hardhat node
npx hardhat deploy --network hardhat
```

## Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

After deployment, copy the ABI from `deployments/sepolia` into the frontend and update the contract address there.

## Frontend Development

```bash
cd src
npm run dev
```

The UI is designed to target Sepolia and reads contracts via viem.

## CLI Tasks

Show contract address:

```bash
npx hardhat task:address --network sepolia
```

Send a message:

```bash
npx hardhat task:send-message --network sepolia --to 0xRecipient --message "hello"
```

Read a message:

```bash
npx hardhat task:get-message --network sepolia --user 0xRecipient --index 0
```

Get inbox size:

```bash
npx hardhat task:count --network sepolia --user 0xRecipient
```

## Security and Privacy Notes

- The message ciphertext is public, but the key is protected by FHE.
- Only users granted access by the contract can decrypt the ephemeral key.
- The message encryption scheme relies on deriving a key from the ephemeral address.
- Loss of the decrypted key means loss of access to the message contents.

## Limitations

- Requires Zama relayer availability for encrypt/decrypt operations.
- On-chain storage costs apply to ciphertext and key handles.
- Inbox data is public metadata (sender, timestamp), even if content is encrypted.

## Roadmap

- Batch message sending and pagination for large inboxes
- Optional multi-recipient key sharing
- UX improvements for decrypt flow and error handling
- Additional analytics for inbox activity (client-side only)
- Gas usage optimizations and event indexing

## License

BSD-3-Clause-Clear. See `LICENSE`.
