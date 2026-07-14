import fs from "fs";
import path from "path";
import chalk from "chalk";

/* =========================================================
   LOG LEVELS
========================================================= */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CATEGORY_COLORS = {
  GRAPH: chalk.blue,
  LLM: chalk.magenta,
  ROUTER: chalk.green,
  CACHE: chalk.yellow,
  AUDIT: chalk.cyan,
  SERVER: chalk.white,
  ERROR: chalk.red
};

const LOG_DIR = path.resolve(
  process.cwd(),
  process.env.LOG_DIR || "logs"
);

const CONFIGURED_LOG_LEVEL = (
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production"
    ? "INFO"
    : "DEBUG")
).toUpperCase();

const LOG_LEVEL = LOG_LEVELS.hasOwnProperty(
  CONFIGURED_LOG_LEVEL
)
  ? CONFIGURED_LOG_LEVEL
  : "INFO";

const MAX_LOG_BYTES = Number(
  process.env.LOG_MAX_BYTES ||
  5 * 1024 * 1024
);

const LOG_FILE_PREFIX =
  process.env.LOG_FILE_PREFIX || "app";

const MAX_META_LENGTH = Number(
  process.env.LOG_META_MAX_LENGTH || 120
);

const MAX_ARRAY_ITEMS = Number(
  process.env.LOG_ARRAY_PREVIEW || 5
);

let currentLogDate = null;
let currentLogFile = null;

/* =========================================================
   FILE MANAGEMENT
========================================================= */

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, {
      recursive: true
    });
  }
}

function getDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getLogFile() {
  ensureLogDir();

  const dateStamp = getDateStamp();

  if (
    currentLogDate === dateStamp &&
    currentLogFile
  ) {
    return currentLogFile;
  }

  currentLogDate = dateStamp;

  currentLogFile = path.join(
    LOG_DIR,
    `${LOG_FILE_PREFIX}-${dateStamp}.log`
  );

  return currentLogFile;
}

async function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;

    const stats = await fs.promises.stat(
      filePath
    );

    if (stats.size < MAX_LOG_BYTES) return;

    const rotatedPath = filePath.replace(
      /\.log$/,
      `-${Date.now()}.log`
    );

    await fs.promises.rename(
      filePath,
      rotatedPath
    );
  } catch (err) {
    console.error(
      chalk.red(
        `[LOGGER ROTATION ERROR] ${err.message}`
      )
    );
  }
}

/* =========================================================
   SECURITY + SANITIZATION
========================================================= */

function sanitizeValue(key, value) {
  if (
    /password|secret|token|authorization|api[-_]?key/i.test(
      key
    )
  ) {
    return "[REDACTED]";
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      stack:
        process.env.NODE_ENV ===
          "production"
          ? undefined
          : value.stack
    };
  }

  if (Array.isArray(value)) {
    const uniqueValues = [
      ...new Set(value.map((v) =>
        JSON.stringify(v)
      ))
    ]
      .slice(0, MAX_ARRAY_ITEMS)
      .map((v) => JSON.parse(v));

    return uniqueValues;
  }

  return value;
}

function sanitizeMeta(meta = {}) {
  const safe = {};

  for (const [key, value] of Object.entries(
    meta || {}
  )) {
    safe[key] = sanitizeValue(key, value);
  }

  return safe;
}

/* =========================================================
   LOG FILTERING
========================================================= */

function shouldLog(level) {
  return (
    LOG_LEVELS[level] <=
    LOG_LEVELS[LOG_LEVEL]
  );
}

/* =========================================================
   TERMINAL COLORS
========================================================= */

function getLevelTag(level) {
  switch (level) {
    case "ERROR":
      return chalk.red.bold("ERROR");
    case "WARN":
      return chalk.yellow.bold("WARN ");
    case "INFO":
      return chalk.cyan("INFO ");
    case "DEBUG":
      return chalk.gray("DEBUG");
    default:
      return level;
  }
}

function getCategoryTag(category) {
  if (!category) return "";

  const colorFn =
    CATEGORY_COLORS[category] || chalk.white;

  return colorFn(`[${category}]`);
}

/* =========================================================
   META FORMATTING
========================================================= */

function truncate(str) {
  if (!str) return str;

  return str.length > MAX_META_LENGTH
    ? str.slice(0, MAX_META_LENGTH) + "..."
    : str;
}

function formatMeta(meta = {}) {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  return Object.entries(meta)
    .filter(
      ([_, value]) =>
        value !== undefined &&
        value !== null
    )
    .map(([key, value]) => {
      let formattedValue;

      if (
        typeof value === "object"
      ) {
        formattedValue = truncate(
          JSON.stringify(value)
        );
      } else {
        formattedValue = truncate(
          String(value)
        );
      }

      return `${chalk.gray(
        key
      )}=${chalk.white(
        formattedValue
      )}`;
    })
    .join(" ");
}

/* =========================================================
   TERMINAL OUTPUT
========================================================= */

function formatConsoleLog(entry) {
  const {
    ts,
    level,
    category,
    message,
    ...meta
  } = entry;

  const shortTime = ts
    .split("T")[1]
    .replace("Z", "")
    .split(".")[0];

  const levelTag = getLevelTag(level);
  const categoryTag = getCategoryTag(
    category
  );
  const metaString = formatMeta(meta);

  return `${chalk.gray(
    shortTime
  )} ${levelTag} ${categoryTag} ${chalk.white(
    message
  )}${metaString ? ` ${metaString}` : ""}`;
}

/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeCategory(category) {
  if (!category) return "SERVER";

  const normalized = String(
    category
  ).toUpperCase();

  if (normalized === "RAG") {
    return "GRAPH";
  }

  return normalized;
}

function normalizeMeta(meta = {}) {
  const normalized = { ...meta };

  if (normalized.source === "rag") {
    normalized.source =
      "knowledge_graph";
  }

  if (normalized.fallback) {
    normalized.llm_fallback =
      normalized.fallback;
    delete normalized.fallback;
  }

  return normalized;
}

/* =========================================================
   MAIN LOGGER
========================================================= */

export function log(
  level,
  category,
  message,
  meta = {}
) {
  const normalizedLevel = String(
    level || "INFO"
  ).toUpperCase();

  if (
    !LOG_LEVELS.hasOwnProperty(
      normalizedLevel
    ) ||
    !shouldLog(normalizedLevel)
  ) {
    return;
  }

  const safeMeta = sanitizeMeta(
    normalizeMeta(meta)
  );

  const entry = {
    ts: new Date().toISOString(),
    level: normalizedLevel,
    category: normalizeCategory(
      category
    ),
    message,
    ...safeMeta
  };

  const serialized = `${JSON.stringify(
    entry
  )}\n`;

  const terminalOutput =
    formatConsoleLog(entry);

  switch (normalizedLevel) {
    case "ERROR":
      console.error(terminalOutput);
      break;
    case "WARN":
      console.warn(terminalOutput);
      break;
    case "DEBUG":
      console.debug(terminalOutput);
      break;
    default:
      console.log(terminalOutput);
      break;
  }

  const filePath = getLogFile();

  rotateIfNeeded(filePath)
    .then(() =>
      fs.promises.appendFile(
        filePath,
        serialized,
        "utf8"
      )
    )
    .catch((err) =>
      console.error(
        chalk.red(
          `[LOGGER WRITE ERROR] ${err.message}`
        )
      )
    );
}

/* =========================================================
   LOGGER API
========================================================= */

function categoryLogger(category) {
  return {
    error: (message, meta = {}) =>
      log(
        "ERROR",
        category,
        message,
        meta
      ),

    warn: (message, meta = {}) =>
      log(
        "WARN",
        category,
        message,
        meta
      ),

    info: (message, meta = {}) =>
      log(
        "INFO",
        category,
        message,
        meta
      ),

    debug: (message, meta = {}) =>
      log(
        "DEBUG",
        category,
        message,
        meta
      )
  };
}

export const logger = {
  error: (
    message,
    meta = {}
  ) =>
    log(
      "ERROR",
      "ERROR",
      message,
      meta
    ),

  warn: (
    message,
    meta = {}
  ) =>
    log(
      "WARN",
      "SERVER",
      message,
      meta
    ),

  info: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "SERVER",
      message,
      meta
    ),

  debug: (
    message,
    meta = {}
  ) =>
    log(
      "DEBUG",
      "SERVER",
      message,
      meta
    ),

  graph: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "GRAPH",
      message,
      meta
    ),

  llm: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "LLM",
      message,
      meta
    ),

  router: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "ROUTER",
      message,
      meta
    ),

  cache: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "CACHE",
      message,
      meta
    ),

  audit: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "AUDIT",
      message,
      meta
    ),

  server: (
    message,
    meta = {}
  ) =>
    log(
      "INFO",
      "SERVER",
      message,
      meta
    ),

  categories: {
    graph: categoryLogger("GRAPH"),
    llm: categoryLogger("LLM"),
    router: categoryLogger("ROUTER"),
    cache: categoryLogger("CACHE"),
    audit: categoryLogger("AUDIT"),
    server: categoryLogger("SERVER")
  }
};

export default logger;
// Foundational token dictionaries (supplemented by regex patterns later)
export const SIGNAL_DICTIONARY = {
  KG: [
    // Core Academic Structure
    'course', 'courses', 'subject', 'subjects',
    'program', 'programs', 'degree', 'specialization', 'specializations',
    'track', 'tracks', 'curriculum', 'academic structure',
    'semester', 'credit hour', 'credits',

    // Prerequisites / Course Dependencies
    'prerequisite', 'prerequisites', 'requirement', 'requirements',
    'required before', 'depends on', 'course sequence',

    // Faculty / Staff
    'professor', 'professors', 'doctor', 'doctors',
    'dean', 'vice dean',
    'teacher', 'teachers',
    'teach', 'teaches', 'teaching',
    'instructor', 'lecturer',
    'staff', 'faculty',
    'teaching assistant', 'ta',

    // Department / Governance
    'department', 'departments',
    'college', 'campus',
    'policy', 'grading policy',
    'grading system', 'gpa',
    'scholarship', 'scholarships',

    // Course Content
    'syllabus', 'schedule',
    'lab', 'labs', 'facility', 'facilities',

    // Career / Outcomes
    'career', 'career role', 'job role',

    // AI College Specific Programs
    'intelligent systems',
    'data science',
    'robotics',

    // Major Courses
    'machine learning',
    'deep learning',
    'mobile computing',
    'cognitive computing',
    'natural language processing',
    'nlp',
    'computer vision',
    'image processing',
    'data mining',
    'cloud computing',
    'high performance computing',
    'block chain',
    'time series',
    'software engineering',
    'operating systems',
    'computing algorithms',
    'reinforcement learning',
    'robotics design',
    'information retrieval',

    // Faculty Names (high-value explicit entities)
    'osama badawy',
    'amr nasr',
    'khaled badran',
    'amira elsaid',
    'nihal mabrouk',
    'eman elakabawy',
    'mohamed talaat',
    'somaya ahmed',
    'ahmed attia',

    // Institution Specific
    'aast',
    'arab academy',
    'college of artificial intelligence'
  ],

  RAG: [
    'gpa', 'academic probation', 'probation', 'fee', 'fees', 'tuition',
    'scholarship', 'scholarships', 'admission', 'admissions', 'registration',
    'transfer', 'policy', 'policies', 'regulation', 'regulations',
    'compliance', 'rule', 'rules', 'handbook', 'deadline', 'withdraw', 'absence'
  ],
  DECISION: [
    'recommend', 'recommendation', 'best major', 'compare', 'difference between',
    'specialization fit', 'advise', 'advising', 'which major', 'choose',
    'help me decide', 'suit me', 'what should i study'
  ],
  CAREER: [
    'career', 'path', 'roadmap', 'future', 'job', 'jobs', 'specialization planning',
    'work as', 'salary', 'industry', 'market', 'employ', 'graduation'
  ],
  FAQ: [
    'where is', 'location', 'campus', 'contact', 'email', 'phone', 'hours',
    'open', 'close', 'wifi', 'password', 'reset'
  ]
};
