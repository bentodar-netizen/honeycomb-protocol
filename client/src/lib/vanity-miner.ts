import { keccak256, encodeAbiParameters, encodePacked, concat, toHex } from 'viem';
import { HONEYCOMB_TOKEN_BYTECODE } from '@/contracts/token-bytecode';

export interface VanityMineResult {
  salt: `0x${string}`;
  address: `0x${string}`;
  attempts: number;
}

export interface VanityMineProgress {
  attempts: number;
  currentAddress: string;
}

export function predictCreate2Address(
  factoryAddress: `0x${string}`,
  salt: `0x${string}`,
  initCodeHash: `0x${string}`
): `0x${string}` {
  const data = concat([
    '0xff',
    factoryAddress,
    salt,
    initCodeHash
  ]);
  const hash = keccak256(data);
  return `0x${hash.slice(-40)}` as `0x${string}`;
}

export function getTokenInitCodeHash(
  name: string,
  symbol: string,
  metadataCID: string,
  creatorBeeId: bigint,
  tokenCreationCode: `0x${string}`
): `0x${string}` {
  const constructorArgs = encodeAbiParameters(
    [
      { type: 'string', name: 'name' },
      { type: 'string', name: 'symbol' },
      { type: 'string', name: 'metadataCID' },
      { type: 'uint256', name: 'creatorBeeId' }
    ],
    [name, symbol, metadataCID, creatorBeeId]
  );
  
  const initCode = concat([tokenCreationCode, constructorArgs]);
  return keccak256(initCode);
}

export function addressEndsWith8888(address: string): boolean {
  return address.toLowerCase().endsWith('8888');
}

export function addressEndsWithBee(address: string): boolean {
  return address.toLowerCase().endsWith('bee');
}

export const BEE_SUFFIX = 'bee';

export function generateRandomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

export function incrementSalt(salt: `0x${string}`): `0x${string}` {
  const saltBigInt = BigInt(salt);
  return `0x${(saltBigInt + BigInt(1)).toString(16).padStart(64, '0')}` as `0x${string}`;
}

export async function mineVanityAddress(
  factoryAddress: `0x${string}`,
  initCodeHash: `0x${string}`,
  suffix: string = '8888',
  maxAttempts: number = 1000000,
  onProgress?: (progress: VanityMineProgress) => void,
  batchSize: number = 1000
): Promise<VanityMineResult | null> {
  let salt = generateRandomSalt();
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    for (let i = 0; i < batchSize && attempts < maxAttempts; i++) {
      const address = predictCreate2Address(factoryAddress, salt, initCodeHash);
      attempts++;
      
      if (address.toLowerCase().endsWith(suffix.toLowerCase())) {
        return { salt, address, attempts };
      }
      
      salt = incrementSalt(salt);
    }
    
    if (onProgress && attempts % 10000 === 0) {
      const currentAddress = predictCreate2Address(factoryAddress, salt, initCodeHash);
      onProgress({ attempts, currentAddress });
    }
    
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return null;
}

export async function mineVanitySaltOffchain(
  factoryAddress: `0x${string}`,
  name: string,
  symbol: string,
  metadataCID: string,
  creatorBeeId: bigint,
  tokenBytecode: `0x${string}`,
  suffix: string = '8888',
  maxAttempts: number = 500000,
  onProgress?: (progress: VanityMineProgress) => void
): Promise<VanityMineResult | null> {
  const initCodeHash = getTokenInitCodeHash(name, symbol, metadataCID, creatorBeeId, tokenBytecode);
  return mineVanityAddress(factoryAddress, initCodeHash, suffix, maxAttempts, onProgress);
}

export async function mineVanityAddressForToken(
  factoryAddress: `0x${string}`,
  name: string,
  symbol: string,
  metadataCID: string,
  creatorBeeId: bigint,
  onProgress?: (progress: VanityMineProgress) => void,
  suffix: string = '8888',
  maxAttempts: number = 200000
): Promise<VanityMineResult | null> {
  let salt = generateRandomSalt();
  let attempts = 0;
  const batchSize = 1000;
  
  const constructorArgs = encodeAbiParameters(
    [
      { type: 'string', name: 'name' },
      { type: 'string', name: 'symbol' },
      { type: 'string', name: 'metadataCID' },
      { type: 'uint256', name: 'creatorBeeId' }
    ],
    [name, symbol, metadataCID, creatorBeeId]
  );
  
  while (attempts < maxAttempts) {
    for (let i = 0; i < batchSize && attempts < maxAttempts; i++) {
      const data = concat([
        '0xff',
        factoryAddress,
        salt,
        keccak256(constructorArgs)
      ]);
      const hash = keccak256(data);
      const address = `0x${hash.slice(-40)}` as `0x${string}`;
      attempts++;
      
      if (address.toLowerCase().endsWith(suffix.toLowerCase())) {
        return { salt, address, attempts };
      }
      
      salt = incrementSalt(salt);
    }
    
    if (onProgress && attempts % 10000 === 0) {
      onProgress({ attempts, currentAddress: '' });
    }
    
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return null;
}

export function estimateTimeToFind(suffix: string): { expectedAttempts: number; estimatedSeconds: number } {
  const probability = 1 / Math.pow(16, suffix.length);
  const expectedAttempts = Math.ceil(1 / probability);
  const attemptsPerSecond = 50000;
  const estimatedSeconds = Math.ceil(expectedAttempts / attemptsPerSecond);
  
  return { expectedAttempts, estimatedSeconds };
}

// Fast off-chain mining using the actual token bytecode
export async function mineVanityAddressFast(
  factoryAddress: `0x${string}`,
  name: string,
  symbol: string,
  metadataCID: string,
  creatorBeeId: bigint,
  onProgress?: (progress: VanityMineProgress) => void,
  suffix: string = '8888',
  maxAttempts: number = 500000
): Promise<VanityMineResult | null> {
  // Compute init code hash using actual bytecode
  const initCodeHash = getTokenInitCodeHash(
    name,
    symbol,
    metadataCID,
    creatorBeeId,
    HONEYCOMB_TOKEN_BYTECODE as `0x${string}`
  );
  
  let salt = generateRandomSalt();
  let attempts = 0;
  const batchSize = 5000; // Large batches for speed
  
  while (attempts < maxAttempts) {
    for (let i = 0; i < batchSize && attempts < maxAttempts; i++) {
      const address = predictCreate2Address(factoryAddress, salt, initCodeHash);
      attempts++;
      
      if (address.toLowerCase().endsWith(suffix.toLowerCase())) {
        if (onProgress) {
          onProgress({ attempts, currentAddress: address });
        }
        return { salt, address, attempts };
      }
      
      salt = incrementSalt(salt);
    }
    
    // Update progress and yield to UI
    if (onProgress) {
      const currentAddress = predictCreate2Address(factoryAddress, salt, initCodeHash);
      onProgress({ attempts, currentAddress });
    }
    
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return null;
}
