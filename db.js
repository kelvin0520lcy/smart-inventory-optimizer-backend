"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var better_sqlite3_1 = require("drizzle-orm/better-sqlite3");
var better_sqlite3_2 = require("better-sqlite3");
var schema = require("@shared/schema");
var sqlite = new better_sqlite3_2.default('server/data.db');
exports.db = (0, better_sqlite3_1.drizzle)(sqlite, { schema: schema });
