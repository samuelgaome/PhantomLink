// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PhantomLink - Encrypted message delivery with Zama FHE
/// @notice Stores encrypted messages and protects the ephemeral key with FHE so only approved users can decrypt it.
contract PhantomLink is ZamaEthereumConfig {
    struct EncryptedMessage {
        address sender;
        string encryptedContent;
        eaddress encryptedKey;
        uint256 timestamp;
    }

    mapping(address => EncryptedMessage[]) private _inbox;

    event MessageSent(address indexed from, address indexed to, uint256 index, uint256 timestamp);
    event KeyShared(address indexed owner, address indexed recipient, uint256 index);

    /// @notice Send an encrypted message to a recipient.
    /// @param recipient The address that should receive the message.
    /// @param encryptedContent The ciphertext of the message encrypted with the ephemeral EOA address.
    /// @param encryptedKeyHandle The encrypted ephemeral address handle produced by the relayer.
    /// @param inputProof Proof associated with the encrypted address.
    /// @return index The index of the message in the recipient inbox.
    function sendMessage(
        address recipient,
        string calldata encryptedContent,
        externalEaddress encryptedKeyHandle,
        bytes calldata inputProof
    ) external returns (uint256 index) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(encryptedContent).length > 0, "Empty message");

        eaddress protectedKey = FHE.fromExternal(encryptedKeyHandle, inputProof);

        EncryptedMessage memory message = EncryptedMessage({
            sender: msg.sender,
            encryptedContent: encryptedContent,
            encryptedKey: protectedKey,
            timestamp: block.timestamp
        });

        _inbox[recipient].push(message);

        FHE.allow(protectedKey, recipient);
        FHE.allow(protectedKey, msg.sender);
        FHE.allowThis(protectedKey);

        index = _inbox[recipient].length - 1;
        emit MessageSent(msg.sender, recipient, index, block.timestamp);
    }

    /// @notice Get the number of messages for a user.
    /// @param user Inbox owner to query.
    function messageCount(address user) external view returns (uint256) {
        return _inbox[user].length;
    }

    /// @notice Fetch a single message from a user inbox.
    /// @param user Inbox owner to query.
    /// @param index Message index to read.
    /// @return sender The address that submitted the message.
    /// @return encryptedContent Ciphertext of the message.
    /// @return encryptedKey Encrypted ephemeral address handle.
    /// @return timestamp Block timestamp when the message was stored.
    function getMessage(
        address user,
        uint256 index
    ) external view returns (address sender, string memory encryptedContent, eaddress encryptedKey, uint256 timestamp) {
        require(index < _inbox[user].length, "Invalid message index");
        EncryptedMessage storage stored = _inbox[user][index];
        return (stored.sender, stored.encryptedContent, stored.encryptedKey, stored.timestamp);
    }

    /// @notice Allow another address to decrypt a message key.
    /// @dev Either the inbox owner or the original sender can grant permissions.
    /// @param user Inbox owner holding the message.
    /// @param index Message index in the inbox.
    /// @param reader Address to grant access to.
    function allowMessageKey(address user, uint256 index, address reader) external {
        require(reader != address(0), "Invalid reader");
        require(index < _inbox[user].length, "Invalid message index");

        EncryptedMessage storage stored = _inbox[user][index];
        require(msg.sender == user || msg.sender == stored.sender, "Not authorized");

        FHE.allow(stored.encryptedKey, reader);

        emit KeyShared(user, reader, index);
    }
}
