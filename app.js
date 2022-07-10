const { MongoClient } = require("mongodb");
const uri = "redacted"
const client = new MongoClient(uri);
client.connect();

var Filter = require('bad-words');
var customFilter = new Filter({ placeHolder: '+' });
var cors = require('cors')

var express = require('express');
var app = express();
app.use(cors())

function enc_trans(l) {
    s = ""
    for (let el of l) {
        // s += `${el.name}+${el.userid}+${el.score}+`
        s += `${el.name}+0+${el.score}+`
    }
    return s.slice(0, -1)
}

app.get(['/api/beats/getlb', '/api/jigsaw/getlb', '/api/matching/getlb'], async (req, res) => {
    let game = req.originalUrl.split('/')[2]
    game = game.toLowerCase()
    let db = client.db(game)
    let mode = req.query.mode;
    if (!mode) {
        res.sendStatus(404)
    } else {
        errs = false
        try {
            if (typeof (mode) != "number") {
                mode = parseInt(mode)
            }
        } catch (err) {
            errs = true
            res.sendStatus(404)
        }
        if (!errs) {
            let cursor = await db.collection('leaderboard').find({
                mode: mode
            }, {
                sort: {
                    score: ((game == "beats" || game == "matching") ? -1 : 1) // descending score for beats, asc for jigsaw
                }
            });
            let top10 = []
            let used = []
            for (let x = 0; x < 10; x++) {
                let r = await cursor.next()
                if (r) {
                    if (used.includes(r.userid)) {
                        x -= 1
                    } else {
                        top10.push(r)
                        used.push(r.userid)
                    }
                } else {
                    break
                }
            }
            res.send(enc_trans(top10))
        }
    }
})

app.get(['/api/beats/getrank', '/api/jigsaw/getrank', '/api/matching/getrank'], async (req, res) => {
    let game = req.originalUrl.split('/')[2]
    game = game.toLowerCase()
    let myScore = req.query.myScore;
    let mode = req.query.mode;
    if (!myScore || !mode) {
        res.sendStatus(404)
    } else {
        console.log(myScore)
        if (typeof (mode) != "number") {
            mode = parseInt(mode)
        }
        let db = client.db(game)
        let cursor = await db.collection('leaderboard').find({
            mode: mode
        }, {
            sort: {
                score: ((game == "beats" || game == "matching") ? -1 : 1) // descending score for beats, asc for jigsaw
            }
        });
        let rank = 0;
        while (true) {
            rank += 1;
            let r = await cursor.next()
            if (!r) {
                break
            } else {
                if (game == "jigsaw") {
                    if (r.score >= myScore) {
                        break
                    }
                } else {
                    if (r.score <= myScore) {
                        break
                    }
                }
                
            }
        }

        res.send(String(rank))
    }
})

app.get(['/api/beats/submitscore', '/api/jigsaw/submitscore', '/api/matching/submitscore'], async (req, res) => {
    let game = req.originalUrl.split('/')[2]
    game = game.toLowerCase()
    let myScore = req.query.myScore;
    let mode = req.query.mode;
    let myID = req.query.myID;
    let myName = req.query.myName;
    let myEmail = req.query.myEmail;
    if (!myScore || !mode || !myID || !myName || !myEmail) {
        res.sendStatus(404)
    } else {
        errs = false
        try {
            if (typeof (myScore) != "number") {
                myScore = parseFloat(myScore)
            }
            if (typeof (mode) != "number") {
                mode = parseInt(mode)
            }
        } catch (err) {
            errs = true
            res.sendStatus(404)
        }
        if (!errs) {
            myName = customFilter.clean(myName);
            myName = myName.replaceAll("+", "")
            myName = myName.replaceAll(" ", "")
            if (myName.length <= 0) {
                myName = "anon"
            }
            // console.log(myName)
            let db = client.db(game)
            let cursor = await db.collection('leaderboard').find({
                userid: myID,
                mode: mode
            }, {
                sort: {
                    score: ((game == "beats" || game == "matching") ? -1 : 1) // descending score for beats, asc for jigsaw
                }
            });
            // console.log("here")

            let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
            let r = await cursor.next()
            if (!r) {
                // new hs
                // console.log("newhs")
                db.collection('leaderboard').insertOne({
                    name: myName,
                    userid: myID,
                    score: myScore,
                    mode: mode,
                    email: myEmail,
                    ip: ip
                })
            } else {
                if (game == "jigsaw") {
                    if (r.score > myScore) {
                        // new hs
                        // console.log("newhs")
                        db.collection('leaderboard').insertOne({
                            name: myName,
                            userid: myID,
                            score: myScore,
                            mode: mode,
                            email: myEmail,
                            ip: ip
                        })
                    }
                } else {
                    if (r.score < myScore) {
                        // new hs
                        // console.log("newhs")
                        db.collection('leaderboard').insertOne({
                            name: myName,
                            userid: myID,
                            score: myScore,
                            mode: mode,
                            email: myEmail,
                            ip: ip
                        })
                    }
                }
            }

            res.sendStatus(200)
        }
    }
})

app.get('*', (req, res) => {
    res.redirect("https://ri-oh-2022.vercel.app/")
})

var port = process.env.PORT || 8080;
app.listen(port, function () {
    console.log('Our app is running on http://localhost:' + port);
});