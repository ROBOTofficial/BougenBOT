import fs from "fs"
import {BOT} from "./index"

const token = fs.readFileSync("./config/token.txt","utf-8")
new BOT(token)