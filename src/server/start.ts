import { cleanUpDaemon } from "./imageStore"
import { setUpLogging } from "./logging"
import * as Server from "./server"

setUpLogging()
Server.httpRedirect()
Server.createServer()
cleanUpDaemon()
