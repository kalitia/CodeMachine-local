import chalk from 'chalk';

type ColorizeFn = (input: string) => string;

type AgentLogger = (chunk: string) => void;

const passthrough: ColorizeFn = (input) => input;

const disableAgentColors = (process.env.CODEMACHINE_PLAIN_LOGS || '').toString() === '1';
const hasTty = Boolean(process.stdout.isTTY || process.stderr.isTTY);
const supportsColor = !disableAgentColors && hasTty && (chalk.level ?? 0) > 0;

const COLOR_PALETTE: ColorizeFn[] = supportsColor
  ? [
      chalk.greenBright,
      chalk.yellowBright,
      chalk.cyanBright,
      chalk.magentaBright,
      chalk.blueBright,
      chalk.redBright,
    ]
  : [passthrough];

const agentColorAssignments = new Map<string, ColorizeFn>();

function getColorizer(agentId: string): ColorizeFn {
  if (agentColorAssignments.has(agentId)) {
    return agentColorAssignments.get(agentId)!;
  }
  const paletteIndex = agentColorAssignments.size % COLOR_PALETTE.length;
  const colorFn = COLOR_PALETTE[paletteIndex] ?? passthrough;
  agentColorAssignments.set(agentId, colorFn);
  return colorFn;
}

function writeSafely(stream: NodeJS.WriteStream, text: string): void {
  try {
    stream.write(text);
  } catch {
    // Suppress stream errors to avoid crashing the workflow runner
  }
}

export function getAgentLoggers(agentId: string): { stdout: AgentLogger; stderr: AgentLogger } {
  const colorize = getColorizer(agentId);
  return {
    stdout(chunk: string) {
      writeSafely(process.stdout, colorize(chunk));
    },
    stderr(chunk: string) {
      writeSafely(process.stderr, colorize(chunk));
    },
  };
}

export function formatAgentLog(agentId: string, message: string): string {
  const colorize = getColorizer(agentId);
  return colorize(message);
}
