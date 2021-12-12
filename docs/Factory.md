# Factory



> Voltz Factory Contract

Deploys Voltz AMMs and manages ownership and control over amm protocol fees



## Methods

### addRateOracle

```solidity
function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress) external nonpayable
```

Adds a new Rate Oracle to the mapping getRateOracleAddress

*The call will revert if the _rateOracleId is invalid, if the _rateOracleAddress is invalid, rate oracle with that address has the given id, key/value already exist in the mapping *

#### Parameters

| Name | Type | Description |
|---|---|---|
| _rateOracleId | bytes32 | A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound)
| _rateOracleAddress | address | Address of the Rate Oracle linked (e.g. Aave v2 Lending Pool)

### ammParameters

```solidity
function ammParameters() external view returns (address factory, address underlyingToken, bytes32 rateOracleId, uint256 termStartTimestamp, uint256 termEndTimestamp)
```

Get the parameters to be used in constructing the pool, set transiently during pool creation.




#### Returns

| Name | Type | Description |
|---|---|---|
| factory | address | undefined
| underlyingToken | address | undefined
| rateOracleId | bytes32 | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined

### calculator

```solidity
function calculator() external view returns (address)
```

Returns the current calculator of the factory

*Can be changed by the current owner via setCalculator*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the calculator

### createAMM

```solidity
function createAMM(address underlyingToken, bytes32 rateOracleId, uint256 termEndTimestamp) external nonpayable returns (address amm)
```

Creates an amm for a given underlying token (e.g. USDC), rateOracleId, and termEndTimestamp

*The call will revert if the amm already exists, underlying token is invalid, the rateOracleId is invalid or the termEndTimeStamp is invalid*

#### Parameters

| Name | Type | Description |
|---|---|---|
| underlyingToken | address | The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC)
| rateOracleId | bytes32 | A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound)
| termEndTimestamp | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| amm | address | The address of the newly created amm

### createMarginEngine

```solidity
function createMarginEngine(address ammAddress) external nonpayable returns (address marginEngine)
```

Creates the Margin Engine for a given AMM (core function: overall margin management, i.g. cash-flows, settlements, liquidations)

*The call will revert if the Margin Engine already exists, amm is invalid*

#### Parameters

| Name | Type | Description |
|---|---|---|
| ammAddress | address | The parent AMM of the Margin Engine

#### Returns

| Name | Type | Description |
|---|---|---|
| marginEngine | address | The address of the newly created Margin Engine

### createVAMM

```solidity
function createVAMM(address ammAddress) external nonpayable returns (address vamm)
```

Creates a concentrated liquidity virtual automated market maker (VAMM) for a given amm

*The call will revert if the VAMM already exists, amm is invalid*

#### Parameters

| Name | Type | Description |
|---|---|---|
| ammAddress | address | The parent AMM of the VAMM

#### Returns

| Name | Type | Description |
|---|---|---|
| vamm | address | The address of the newly created VAMM

### getAMMMAp

```solidity
function getAMMMAp(bytes32, address, uint256, uint256) external view returns (address)
```

Returns the amm address for a given rateOracleId, underlyingToken, termStartTimestamp, termEndTimestamp



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined
| _1 | address | undefined
| _2 | uint256 | undefined
| _3 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | amm The amm address

### getRateOracleAddress

```solidity
function getRateOracleAddress(bytes32) external view returns (address)
```

Returns the address of the Rate Oracle Contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the Rate Oracle Contract

### insuranceFund

```solidity
function insuranceFund() external view returns (address)
```

Returns the current insurance fund of the factory (i.e. Voltz Insurance/Incentives Engine)

*Can be changed by the current owner via setInsuranceFund*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the Incentives Engine

### marginEngineParameters

```solidity
function marginEngineParameters() external view returns (address ammAddress)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| ammAddress | address | undefined

### owner

```solidity
function owner() external view returns (address)
```

Returns the current owner of the factory

*Can be changed by the current owner via setOwner*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the factory owner

### setCalculator

```solidity
function setCalculator(address _calculator) external nonpayable
```

Updates the calculator of the factory

*Must be called by the current owner*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _calculator | address | The new calculator of the factory

### setInsuranceFund

```solidity
function setInsuranceFund(address _insuranceFund) external nonpayable
```

Updates the Incentives Engine of the factory

*Must be called by the current owner*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _insuranceFund | address | The new Incentives Engine of the factory

### setOwner

```solidity
function setOwner(address _owner) external nonpayable
```

Updates the owner of the factory

*Must be called by the current owner*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _owner | address | The new owner of the factory

### setTreasury

```solidity
function setTreasury(address _treasury) external nonpayable
```

Updates the treasury of the factory

*Must be called by the current owner*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _treasury | address | The new treasury of the factory

### treasury

```solidity
function treasury() external view returns (address)
```

Returns the current treasury of the factory (i.e. Voltz Treasury)

*Can be changed by the current owner via setTreasury*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The address of the treasury

### vammParameters

```solidity
function vammParameters() external view returns (address ammAddress)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| ammAddress | address | undefined



## Events

### OwnerChanged

```solidity
event OwnerChanged(address indexed oldOwner, address indexed newOwner)
```

Emitted when the owner of the factory is changed



#### Parameters

| Name | Type | Description |
|---|---|---|
| oldOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |


