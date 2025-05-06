// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import './IERC721Receiver.sol';

contract ERC721 {
    string public name;
    string public symbol;

    uint256 public nextTokenIdToMint;
    address public contractOwner;

    // token id => owner
    mapping(uint256 => address) internal _owners;
    // owner => token count
    mapping(address => uint256) internal _balances;
    // owner => (operator => yes/no)
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    // token id => (approved address => status)
    mapping(uint256 => mapping(address => bool)) private _multiTokenApprovals;
    // token id => token uri
    mapping(uint256 => string) _tokenUris;

    // EVENTS
    event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
    event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId);
    event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);
    event MultiApproval(address indexed owner, address indexed approved, uint256 indexed tokenId, bool approvedStatus);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        nextTokenIdToMint = 0;
        contractOwner = msg.sender;
    }


    // MODIFIERS
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

    function safeTransferFrom(address _from, address _to, uint256 _tokenId) public payable {
        safeTransferFrom(_from, _to, _tokenId, "");
    }

    function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes memory _data) public payable {
        require(
            ownerOf(_tokenId) == msg.sender ||
            _operatorApprovals[ownerOf(_tokenId)][msg.sender] ||
            _multiTokenApprovals[_tokenId][msg.sender],
            "ERC721: not authorized"
        );

        _transfer(_from, _to, _tokenId);

        // Trigger check
        require(_checkOnERC721Received(_from, _to, _tokenId, _data), "!ERC721Implementer");
    }

    function transferFrom(address _from, address _to, uint256 _tokenId) public payable {
        // unsafe transfer without onERC721Received, used for contracts that don't implement IERC721Receiver
        require(
            ownerOf(_tokenId) == msg.sender ||
            _operatorApprovals[ownerOf(_tokenId)][msg.sender] ||
            _multiTokenApprovals[_tokenId][msg.sender],
            "ERC721: not authorized"
        );

        _transfer(_from, _to, _tokenId);
    }

    function approve(address[] memory _approved, uint256 _tokenId) public payable onlyTokenOwner(_tokenId) {
        for (uint256 i = 0; i < _approved.length; i++) {
            _multiTokenApprovals[_tokenId][_approved[i]] = true;
            emit MultiApproval(ownerOf(_tokenId), _approved[i], _tokenId, true);
        }
    }

    // revokeApproval removes specific addresses from the list of approved addresses for a given tokenId.
    // This is useful to revoke subcontract or delegated transfer rights from previously authorized addresses.
    function revokeApproval(address[] memory _revoked, uint256 _tokenId) public onlyTokenOwner(_tokenId) {
        for (uint256 i = 0; i < _revoked.length; i++) {
            _multiTokenApprovals[_tokenId][_revoked[i]] = false;
            emit MultiApproval(ownerOf(_tokenId), _revoked[i], _tokenId, false);
        }
    }

    function setApprovalForAll(address[] memory _operators, bool _approved) public {
        for (uint256 i = 0; i < _operators.length; i++) {
            _operatorApprovals[msg.sender][_operators[i]] = _approved;
            emit ApprovalForAll(msg.sender, _operators[i], _approved);
        }
    }


    function isApprovedForToken(uint256 _tokenId, address _operator) public view returns (bool) {
        return _multiTokenApprovals[_tokenId][_operator];
    }

    function isApprovedForAll(address _owner, address _operator) public view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    function mintTo(address _to, string memory _uri) public onlyContractOwner() validAddress(_to) {
        _owners[nextTokenIdToMint] = _to;
        _balances[_to] += 1;
        _tokenUris[nextTokenIdToMint] = _uri;        
        emit Transfer(address(0), _to, nextTokenIdToMint);

        nextTokenIdToMint += 1;
    }

    function batchMint(address _to, string[] memory _uris) public onlyContractOwner validAddress(_to) {
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
    ) private returns (bool) {
        // check if to is an contract, if yes, to.code.length will always be > 0
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    function _transfer(address _from, address _to, uint256 _tokenId) internal validAddress(_to) {
        _balances[_from] -= 1;
        _balances[_to] += 1;
        _owners[_tokenId] = _to;

        emit Transfer(_from, _to, _tokenId);
    }
}