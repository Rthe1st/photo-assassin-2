import { setUpLogging } from "./logging"
import * as Server from "./server"

setUpLogging()
Server.createServer()
