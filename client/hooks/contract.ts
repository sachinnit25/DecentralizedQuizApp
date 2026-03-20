"use client";

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
  isAllowed,
  requestAccess,
} from "@stellar/freighter-api";

// ============================================================
// CONSTANTS — Update these for your contract
// ============================================================

/** Your deployed Soroban contract ID */
export const CONTRACT_ADDRESS =
  "CBJE3UL6AKAIMWM5BKOFNREF7NTBL7ABX2D2Q74YPXNMUYOXAZBP276X";

/** Network passphrase (testnet by default) */
export const NETWORK_PASSPHRASE = Networks.TESTNET;

/** Soroban RPC URL */
export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Horizon URL */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Network name for Freighter */
export const NETWORK = "TESTNET";

// ============================================================
// RPC Server Instance
// ============================================================

const server = new rpc.Server(RPC_URL);

// ============================================================
// Wallet Helpers
// ============================================================

export async function checkConnection(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error("Freighter extension is not installed or not available.");
  }

  const allowedResult = await isAllowed();
  if (!allowedResult.isAllowed) {
    await setAllowed();
    await requestAccess();
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve wallet address from Freighter.");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) return null;

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return null;

    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ============================================================
// Contract Interaction Helpers
// ============================================================

/**
 * Build, simulate, and optionally sign + submit a Soroban contract call.
 */
export async function callContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller: string,
  sign: boolean = true
) {
  const contract = new Contract(CONTRACT_ADDRESS);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${(simulated as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  if (!sign) {
    return simulated;
  }

  const prepared = rpc.assembleTransaction(tx, simulated).build();

  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const result = await server.sendTransaction(txToSubmit);

  if (result.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${result.status}`);
  }

  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "FAILED") {
    throw new Error("Transaction failed on chain.");
  }

  return getResult;
}

/**
 * Read-only contract call (does not require signing).
 */
export async function readContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller?: string
) {
  const account =
    caller || Keypair.random().publicKey();
  const sim = await callContract(method, params, account, false);
  if (
    rpc.Api.isSimulationSuccess(sim as rpc.Api.SimulateTransactionResponse) &&
    (sim as rpc.Api.SimulateTransactionSuccessResponse).result
  ) {
    return scValToNative(
      (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval
    );
  }
  return null;
}

// ============================================================
// ScVal Conversion Helpers
// ============================================================

export function toScValString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function toScValU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function toScValAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function toScValBool(value: boolean): xdr.ScVal {
  return nativeToScVal(value, { type: "bool" });
}

// ============================================================
// Decentralized Quiz — Contract Methods
// ============================================================

/**
 * Create a new quiz. Anyone can create quizzes - fully permissionless.
 * Returns the unique quiz ID.
 */
export async function createQuiz(
  caller: string,
  questions: string[],
  answers: string[]
): Promise<number> {
  const questionVals = questions.map((q) => toScValString(q));
  const answerVals = answers.map((a) => toScValString(a));

  const result = await callContract(
    "create_quiz",
    [
      toScValAddress(caller),
      nativeToScVal(questionVals, { type: "vec<string>" }),
      nativeToScVal(answerVals, { type: "vec<string>" }),
    ],
    caller,
    true
  );
  
  // Parse the result to get the quiz ID
  if (result) {
    const getResult = result as rpc.Api.GetSuccessfulTransactionResponse;
    if (getResult.returnValue) {
      return scValToNative(getResult.returnValue) as number;
    }
  }
  return 0;
}

/**
 * Answer a question in a quiz. Requires auth from the user.
 * Permissionless - anyone can answer any question in any quiz.
 */
export async function answerQuestion(
  caller: string,
  quizId: number,
  questionIndex: number,
  answer: string
) {
  return callContract(
    "answer_question",
    [
      toScValAddress(caller),
      toScValU32(quizId),
      toScValU32(questionIndex),
      toScValString(answer),
    ],
    caller,
    true
  );
}

/**
 * Get the score for a user on a specific quiz.
 */
export async function getScore(address: string, quizId: number, caller?: string): Promise<number> {
  const result = await readContract(
    "get_score",
    [toScValAddress(address), toScValU32(quizId)],
    caller
  );
  return result !== null ? Number(result) : 0;
}

/**
 * Get a question by index from a specific quiz.
 */
export async function getQuestion(quizId: number, index: number, caller?: string): Promise<string | null> {
  const result = await readContract(
    "get_question",
    [toScValU32(quizId), toScValU32(index)],
    caller
  );
  return result !== null ? String(result) : null;
}

/**
 * Get the total number of questions in a quiz.
 */
export async function getTotalQuestions(quizId: number, caller?: string): Promise<number> {
  const result = await readContract(
    "get_total_questions",
    [toScValU32(quizId)],
    caller
  );
  return result !== null ? Number(result) : 0;
}

/**
 * Get all quiz IDs created on this contract.
 */
export async function getAllQuizIds(caller?: string): Promise<number[]> {
  const result = await readContract(
    "get_all_quiz_ids",
    [],
    caller
  );
  if (result && Array.isArray(result)) {
    return result.map((v: unknown) => Number(v));
  }
  return [];
}

/**
 * Get all questions for a quiz.
 */
export async function getQuizQuestions(quizId: number, caller?: string): Promise<string[]> {
  const result = await readContract(
    "get_quiz_questions",
    [toScValU32(quizId)],
    caller
  );
  if (result && Array.isArray(result)) {
    return result.map((v: unknown) => String(v));
  }
  return [];
}

/**
 * Get leaderboard for a quiz.
 */
export async function getLeaderboard(quizId: number, caller?: string): Promise<Array<{ user: string; score: number }>> {
  const result = await readContract(
    "get_leaderboard",
    [toScValU32(quizId)],
    caller
  );
  if (result && Array.isArray(result)) {
    return result.map((entry: unknown) => {
      const e = entry as { user: string; score: number };
      return {
        user: e.user,
        score: Number(e.score),
      };
    });
  }
  return [];
}

export { nativeToScVal, scValToNative, Address, xdr };
