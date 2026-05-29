#!/usr/bin/env node

import { Command } from 'commander'
import auth from '../src/commands/auth.js'
import config from '../src/commands/config.js'
import record from '../src/commands/record.js'
import timeline from '../src/commands/timeline.js'
import weight from '../src/commands/weight.js'
import exercise from '../src/commands/exercise.js'
import diet from '../src/commands/diet.js'
import food from '../src/commands/food.js'
import sleep from '../src/commands/sleep.js'
import { checkVersion, getCliVersion } from '../src/lib/version-check.js'

const program = new Command()

program
  .name('hum')
  .description('Health tracking CLI')
  .version(getCliVersion())

program.hook('preAction', async (thisCommand) => {
  const commandName = thisCommand.name()
  if (commandName !== 'auth') {
    await checkVersion()
  }
})

program.addCommand(auth)
program.addCommand(config)
program.addCommand(record)
program.addCommand(timeline)
program.addCommand(weight)
program.addCommand(exercise)
program.addCommand(diet)
program.addCommand(food)
program.addCommand(sleep)

program.parse()
