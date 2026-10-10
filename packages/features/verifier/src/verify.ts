import { diffLines, outputsMatch, normalizeOutput } from './compare';
import type {
  SandboxRun,
  Script,
  ScriptWriter,
  VerifyErrorReason,
  VerifyErrorResult,
  VerifyRequest,
  VerifyResult,
} from './types';

export interface VerifyDeps {
  writer: ScriptWriter;
  run: SandboxRun;
}

function error(
  claim: string,
  reason: VerifyErrorReason,
  message: string,
  stderr?: string,
): VerifyErrorResult {
  return stderr
    ? { status: 'error', claim, reason, message, stderr }
    : { status: 'error', claim, reason, message };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Ask the writer for a script, run it in the sandbox, and compare what it printed with the
 * expected answer. Never throws: every failure becomes a `status: "error"` result so the UI can
 * show it instead of a stack trace.
 */
export async function verify(req: VerifyRequest, deps: VerifyDeps): Promise<VerifyResult> {
  const claim = typeof req?.claim === 'string' ? req.claim : '';
  if (!claim.trim() || typeof req.expected !== 'string' || !req.expected.trim()) {
    return error(claim, 'invalid_request', 'Both "claim" and "expected" are required.');
  }

  let script: Script;
  try {
    script = await deps.writer.write(req);
  } catch (e) {
    return error(claim, 'no_script', `Could not get a script for this claim: ${errorMessage(e)}`);
  }

  let result;
  try {
    result = await deps.run({ interpreter: script.language, code: script.code });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    const reason: VerifyErrorReason =
      code === 'interpreter_not_found' || code === 'docker_unavailable'
        ? 'sandbox_unavailable'
        : 'sandbox_error';
    return error(claim, reason, errorMessage(e));
  }

  if (result.timedOut) {
    return error(claim, 'timeout', 'The script ran too long and was stopped.', result.stderr);
  }
  if (result.truncated) {
    return error(claim, 'output_limit', 'The script printed more than the output limit allows.');
  }
  if (result.exitCode !== 0) {
    return error(
      claim,
      'script_failed',
      `The script exited with code ${result.exitCode ?? 'unknown'}.`,
      result.stderr,
    );
  }

  const ran = {
    language: script.language,
    code: script.code,
    durationMs: result.durationMs,
    mode: result.mode,
  };
  const actual = normalizeOutput(result.stdout);
  const expected = normalizeOutput(req.expected);

  if (outputsMatch(expected, actual)) {
    return { status: 'verified', claim, expected, actual, ran };
  }
  return {
    status: 'mismatch',
    claim,
    expected,
    actual,
    diff: diffLines(expected, actual),
    ran,
  };
}
