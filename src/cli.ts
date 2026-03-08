#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerDemoCommand } from './commands/demo.js';

dotenv.config();

const program = new Command();

program
  .name('newsroom-radar')
  .description('AI-powered audience intelligence for local newsrooms')
  .version('0.1.0');

registerAnalyzeCommand(program);
registerDemoCommand(program);

program.parse();
