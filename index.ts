import axios from "axios";
import WebSocket from "ws";
import fs from "fs";

process.on("uncaughtExceptionMonitor",(err) => {
    console.log(err)
})

interface infos { 
    d:{
        content:string
        heartbeat_interval:number
        id:string
        token:string
        data:{
            name:string
            options: {
                value: string
            }[];
        }
        guild_id:string
        channel_id:string
        author:{
            id:string
            bot:undefined|boolean
        }
        user:{
            id:string
        }
        member:{
            user:{
                id:string
            }
        }
        referenced_message:{
            id:string
            author:{
                id:string
            }
        } | null
    }
    t: string
}
interface ConfigInterFace {
    AnswerProbability:number
    version:string
    NonDetection:{
        guilds:string[]
        channels:string[]
    }
}

export class BOT {
    public ws:WebSocket
    public token:string
    public BotID:string
    public PermissionLIST:string[]
    public BougenLIST:string
    public Config:ConfigInterFace
    public AnswerProbability:number
    public heartbeat_interval:NodeJS.Timeout

    constructor(token:string) {
        this.token = token
        this.BotID = ""
        this.PermissionLIST = JSON.parse(fs.readFileSync("./bougen/permission.json","utf-8"))
        this.BougenLIST = fs.readFileSync("./bougen/bougen.txt","utf-8")
        this.Config = JSON.parse(fs.readFileSync("./bougen/config.json","utf-8"))
        this.AnswerProbability = this.Config["AnswerProbability"]
        this.ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json")
        this.heartbeat_interval = setInterval(() => {},10000)
        this.BotStart()
    }
    BotStart() {
        this.ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json")
        this.ws.on('open', () => {
            const StartData = {
                op: 2,
                d: {
                    token: this.token,
                    intents: 33281,
                    properties: {
                    $os: 'linux',
                    $browser: 'original',
                    $device: 'original',
                    },
                },
            };
          
            this.ws.send(JSON.stringify(StartData))
        });
        this.ws.on("message",async (data:string) => {
            //console.log(data.toString())
            const message:infos = JSON.parse(data)
            if (message.d != null) {
                if (typeof message.d.heartbeat_interval != "undefined") this.heartbeat(message.d.heartbeat_interval)
            }
            if (message["t"] === "READY") {
                this.BotID = message.d.user.id
                this.InteractionCreate()
            }
            if (message["t"] === "INTERACTION_CREATE") {
                this.ReplyInteraction(message.d.id,message.d.token,message)
            }
            if (message["t"] === "MESSAGE_CREATE" && message.d.content !== "" && message.d.author.bot !== true) {
                if (!(await this.NonDetectionCheck(message))) this.BougenReply(message.d.content,message)

                //権限持ち
                if ((await this.PermissionCheck(message.d.author.id))) {
                    const args = message.d.content.split(" ")
                    if (message.d.content === "bougen list") {
                        this.MessageSend(`${this.BougenLIST.split("\n").length-1}個の暴言が登録されています。\n\`\`\`${this.BougenLIST}\`\`\``,message,true)
                    }
                    if (message.d.content === "bougen urahelp") this.MessageSend(fs.readFileSync("./bougen/help.txt","utf-8"),message,true)
                    if (message.d.content.startsWith("bougen add") && args[2] !== undefined) {
                        let Bougen = this.BougenLIST.split("\n")
                        for (let i = 0; i < 2; i++) args.shift()
                        let content = args.join(" ")
                        if (!Bougen.includes(content)) {
                            fs.appendFileSync("./bougen/bougen.txt",`${content}\n`)
                            this.BougenLIST = fs.readFileSync("./bougen/bougen.txt","utf-8")
                            this.MessageSend(`**${content}** を暴言リストに登録しました。\n現在暴言リストには${this.BougenLIST.split("\n").length-1}個の暴言が登録されています。`,message,true)
                        } else this.MessageSend("既に登録されています",message,true)
                    } else if (message.d.content.startsWith("bougen remove") && args[2] !== undefined) {
                        let Bougen = this.BougenLIST.split("\n")
                        for (let i = 0; i < 2; i++) args.shift()
                        let content = args.join(" ")
                        if (Bougen.includes(content)) {
                            Bougen = Bougen.filter(value => value !== content)
                            fs.writeFileSync("./bougen/bougen.txt","")
                            for (let i = 0; i < Bougen.length; i++) if (Bougen[i] !== "") fs.appendFileSync("./bougen/bougen.txt",`${Bougen[i]}\n`)
                            this.BougenLIST = fs.readFileSync("./bougen/bougen.txt","utf-8")
                            this.MessageSend(`**${content}** を暴言リストから削除しました。\n現在暴言リストには${this.BougenLIST.split("\n").length-1}個の暴言が登録されています。`,message,true)
                        } else this.MessageSend("登録されていません",message,true)
                    } else if (message.d.content.startsWith("bougen search") && args[2] !== undefined) {
                        let Bougen = this.BougenLIST.split("\n")
                        let content = args[2]
                        if (Bougen.includes(content)) {
                            this.MessageSend("登録済みです。",message,true)
                        } else this.MessageSend("登録されていません",message,true)
                    } else if (message.d.content.startsWith("bougen guild") && args[2] !== undefined) {
                        let result = await this.NonDetection("guilds",args[2])
                        this.MessageSend(`${args[2]}を非検知サーバー${result === "add" ? "に追加" : "から削除"}しました。`,message,true)
                    } else if (message.d.content.startsWith("bougen channel") && args[2] !== undefined) {
                        let result = await this.NonDetection("channels",args[2])
                        this.MessageSend(`${args[2]}を非検知チャンネル${result === "add" ? "に追加" : "から削除"}しました。`,message,true)
                    }
                }

                //Ownerだけ
                if (message.d.author.id === "1115251250183802921") {
                    const args = message.d.content.split(" ")
                    if (message.d.content === "bougen permission list") {
                        let text = ""
                        for (let i = 0; i < this.PermissionLIST.length; i++) text += `<@!${this.PermissionLIST[i]}>\n`
                        this.MessageSend(text,message,true)
                    }
                    if (message.d.content.startsWith("bougen permission add") && args[3] !== undefined) {
                        let UserID = args[3]
                        if (!this.PermissionLIST.includes(UserID)) {
                            this.PermissionLIST.push(UserID)
                            fs.writeFileSync("./bougen/permission.json",JSON.stringify(this.PermissionLIST))
                            this.MessageSend(`<@!${UserID}> に権限を付与しました。`,message,true)
                        } else this.MessageSend("既に登録されています",message,true)
                    }
                    if (message.d.content.startsWith("bougen permission remove") && args[3] !== undefined) {
                        let UserID = args[3]
                        if (this.PermissionLIST.includes(UserID)) {
                            this.PermissionLIST = this.PermissionLIST.filter(value => value !== UserID)
                            fs.writeFileSync("./bougen/permission.json",JSON.stringify(this.PermissionLIST))
                            this.MessageSend(`<@!${UserID}> から権限を剥奪しました`,message,true)
                        } else this.MessageSend("登録されていません",message,true)
                    }
                    if (message.d.content.startsWith("bougen per") && args[2] !== undefined && !isNaN(Number(args[2]))) {
                        this.Config["AnswerProbability"] = Number(args[2])
                        this.AnswerProbability = Number(args[2])
                        fs.writeFileSync("./bougen/config.json",JSON.stringify(this.Config,null,"\t"))
                        this.MessageSend(`メッセージ内に暴言が含まれている場合にリプを送る確率を**${this.AnswerProbability}%**にしました`,message,true)
                    }
                }
            }
        })
        this.ws.on("close", () => {
            clearInterval(this.heartbeat_interval)
            this.BotStart()
        })
    }
    async NonDetectionCheck(Message:infos) {
        return this.Config.NonDetection.guilds.includes(Message.d.guild_id) || this.Config.NonDetection.channels.includes(Message.d.channel_id)
    }
    async NonDetection(type:"channels"|"guilds",content:string):Promise<"remove"|"add"> {
        let includesCheck = this.Config.NonDetection[type].includes(content)
        if (includesCheck) {
            this.Config.NonDetection[type] = this.Config.NonDetection[type].filter(value => value !== content)
        } else this.Config.NonDetection[type].push(content)
        fs.writeFileSync("./bougen/config.json",JSON.stringify(this.Config,null,"\t"))
        return includesCheck ? "remove" : "add"
    }
    async PermissionCheck(id:string):Promise<boolean> {
        return this.PermissionLIST.includes(id)
    }
    async BotMessageReply(Message:infos):Promise<boolean> {
        let ReferencedMessage = Message.d.referenced_message
        return ( typeof ReferencedMessage !== "undefined" && ReferencedMessage !== null && typeof ReferencedMessage.author === "object" && ReferencedMessage.author.id === this.BotID) ? true : false
    }
    async BougenReply(content:string,Message:infos) {
        let Bougen = this.BougenLIST.split("\n")
        if (Bougen.includes(content) || ((await this.RandomReply()) && (await this.ReplyContext(content))) || (await this.BotMessageReply(Message))) {
            this.MessageSend((await this.RandomBougen()),Message,true)
        }
    }
    async RandomBougen():Promise<string> {
        let Bougen = this.BougenLIST.split("\n")
        let BougenContext = Bougen[Math.floor(Math.random()*Bougen.length)]
        if (BougenContext !== "") {
            return BougenContext
        } else return this.RandomBougen()
    }
    async RandomReply():Promise<boolean> {
        return (Math.floor(Math.random()*100) < this.AnswerProbability)
    }
    async ReplyContext(content:string):Promise<boolean> {
        let Bougen = this.BougenLIST.split("\n")
        for (let i = 0; i < Bougen.length; i++) {
            if (Bougen[i] === "") continue
            if (content.includes(Bougen[i])) return true
        }
        return false
    }
    async MessageSend(content:string,Message:infos,reply:boolean) {
        let MessageContent:{[key:string]:object|string|boolean} = {
            content:content,
            tts:false
        }
        if (reply === true) MessageContent["message_reference"] = {
            guild_id:Message.d.guild_id,
            channel_id:Message.d.channel_id,
            message_id:Message.d.id
        }
        await axios.post(
            `https://discord.com/api/v10/channels/${Message.d.channel_id}/messages`,JSON.stringify(MessageContent), {
                headers:{
                    "Authorization":`Bot ${this.token}`,
                    "Content-Type": "application/json",
                }
            }
        ).catch(() => {})
    }
    async InteractionCreate() {
        let data = [
            {
                name:"help",
                description:"ヘルプを表示します"
            },
            {
                name:"list",
                description:"リストを表示します"
            }
        ]
        for (let i = 0; i < data.length; i++) {
            await axios.post(
                `https://discord.com/api/v10/applications/${this.BotID}/commands`,JSON.stringify(data[i]),{
                    headers:{
                        "Authorization":`Bot ${this.token}`,
                        "Content-Type":"application/json"
                    }
                }
            ).catch((error) => console.log(error))
        }
    }
    async ReplyInteraction(InteractionID:string,InteractionToken:string,Message:infos) {
        let data:{[key:string]:object|number|string} = {}
        if (Message.d.data.name === "help") {
            data = {
                type:4,
                data:{
                    content:"冷静に考えてこんなボットにヘルプなんかあるわけなくない？"
                }
            }
        } else if (Message.d.data.name === "list") {
            data = {
                type:4,
                data: {
                    content:`\`\`\`${this.BougenLIST}\`\`\``
                }
            }
        }
        await axios.post(
            `https://discord.com/api/v10/interactions/${InteractionID}/${InteractionToken}/callback`,JSON.stringify(data),
            {
                headers:{
                    "Authorization":`Bot ${this.token}`,
                    "Content-Type":"application/json"
                }
            }
        )
    }
    async GetGuildList():Promise<Array<object>> {
        let response = await axios.get(
            `https://discord.com/api/users/@me/guilds`,{
                headers:{
                    Authorization:`Bot ${this.token}`
                }
            }
        )
        if (response.status !== 200) return []
        let GuildList:Array<{}> = response.data
        return GuildList
    }
    async GamePlayUpdate() {
        let GuildLIST = await this.GetGuildList()
        this.ws.send(JSON.stringify({
            op:3,
            d:{
                since:null,
                activities:[{
                    name:`v${this.Config.version} | ${GuildLIST.length}guilds`,
                    type:0
                }],
                status:"online",
                afk:false
            }
        }))
    }
    heartbeat(heartbeat_interval:number) {
        this.heartbeat_interval = setInterval(() => {
            this.ws.send(JSON.stringify({
                op:1,
                d:{}
            }))
            this.GamePlayUpdate()
        },heartbeat_interval)
    }
}
