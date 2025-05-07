// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import './IERC721Receiver.sol';

contract ERC721 is IERC721, IERC721Metadata, ReentrancyGuard {
    string public name;
    string public symbol;

    uint256 public nextTokenIdToMint;
    address public contractOwner;

    // token id => owner
    mapping(uint256 => address) internal _owners;
    // owner => token count
    mapping(address => uint256) internal _balances;
    // token id => approved address
    mapping(uint256 => address) internal _tokenApprovals;
    // owner => (operator => yes/no)
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    // token id => token uri
    mapping(uint256 => string) public _tokenUris;


    constructor(string memory _name, string memory _symbol) {
        require(bytes(_name).length > 0 && bytes(_symbol).length > 0, "ERC721: name and symbol required");
        
        name = _name;
        symbol = _symbol;
        nextTokenIdToMint = 0;
        contractOwner = msg.sender;
    }


    // MODIFIERS
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
    modifier onlyContractOwner() {  
        require(msg.sender == contractOwner, "ERC721: Only contract owner");
        _;
    }
    modifier onlyTokenOwner(uint256 _tokenId) {
        require(ownerOf(_tokenId) == msg.sender, "ERC721: invalid token ID");
        _;
    }
    modifier validAddress(address _addr) {
        require(_addr != address(0), "ERC721: Invalid address");
        _;
    }
    modifier tokenExists(uint256 _tokenId) {
        require(_owners[_tokenId] != address(0), "ERC721: Token does not exist");
        _;
    }
    

    function balanceOf(address _owner) public view validAddress(_owner) returns(uint256) {
        return _balances[_owner];
    }

    function ownerOf(uint256 _tokenId) public view tokenExists(_tokenId) returns(address) {
        return _owners[_tokenId];
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId) public {
        safeTransferFrom(_from, _to, _tokenId, "");
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes memory _data) public {
        require(_isApprovedOrOwner(msg.sender, _tokenId), "ERC721: caller is not owner nor approved");
        _transfer(_from, _to, _tokenId);
        // Trigger check to ensure recipient contract implements onERC721Received
        require(_checkOnERC721Received(_from, _to, _tokenId, _data), "!ERC721Implementer");
    }

    function transferFrom(address _from, address _to, uint256 _tokenId) public {
        // unsafe transfer without onERC721Received, used for contracts that don't implement IERC721Receiver
        require(_isApprovedOrOwner(msg.sender, _tokenId), "ERC721: caller is not owner nor approved");
        _transfer(_from, _to, _tokenId);
    }

    function approve(address _approved, uint256 _tokenId) public onlyTokenOwner(_tokenId) {
        require(_approved != msg.sender, "ERC721: cannot approve self");
        _tokenApprovals[_tokenId] = _approved;
        emit Approval(ownerOf(_tokenId), _approved, _tokenId);
    }

    function setApprovalForAll(address _operator, bool _approved) public {
        _operatorApprovals[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    function getApproved(uint256 _tokenId) public view returns (address) {
        return _tokenApprovals[_tokenId];
    }

    function isApprovedForAll(address _owner, address _operator) public view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    // Mint a new token to a specified address with a metadata URI
    function mintTo(address _to, string memory _uri) public onlyContractOwner() validAddress(_to) nonReentrant {
        _owners[nextTokenIdToMint] = _to;
        _balances[_to] += 1;
        _tokenUris[nextTokenIdToMint] = _uri;        
        emit Transfer(address(0), _to, nextTokenIdToMint);

        nextTokenIdToMint += 1;
    }

    // Batch mint multiple tokens to a single address with respective URIs
    function batchMint(address _to, string[] memory _uris) public onlyContractOwner validAddress(_to) nonReentrant {
        require(_uris.length > 0, "ERC721: Must provide at least one URI");

        uint256 startTokenId = nextTokenIdToMint;
        uint256 numberOfTokens = _uris.length;

        for (uint256 i = 0; i < numberOfTokens; i++) {
            _owners[startTokenId + i] = _to;
            _tokenUris[startTokenId + i] = _uris[i];

            emit Transfer(address(0), _to, startTokenId + i);
        }

        _balances[_to] += numberOfTokens;
        nextTokenIdToMint += numberOfTokens;
    }

    function tokenURI(uint256 _tokenId) public view tokenExists(_tokenId) returns(string memory) {
        return _tokenUris[_tokenId];
    }

    function totalSupply() public view returns(uint256) {
        return nextTokenIdToMint;
    }


    // INTERNAL FUNCTIONS
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal returns (bool) {
        // check if to is a contract, if yes, to.code.length will always be > 0
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                // If no revert reason is returned, revert with generic error
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    /// @solidity memory-safe-assembly
                    // Bubble up revert reason from the called contract
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            // If recipient is not a contract, assume it can receive tokens
            return true;
        }
    }

    // Internal transfer function handling balances and ownership updates
    function _transfer(address _from, address _to, uint256 _tokenId) internal validAddress(_to) {
        // Clear approvals by setting to zero address, saves gas compared to delete
        _tokenApprovals[_tokenId] = address(0);
        _balances[_from] -= 1;
        _balances[_to] += 1;
        _owners[_tokenId] = _to;

        emit Transfer(_from, _to, _tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId;
    }
}