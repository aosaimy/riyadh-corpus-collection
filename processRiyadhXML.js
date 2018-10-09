"use strict"
var cheerio = require('cheerio')
var ed = require('edit-distance');

var fs = require('fs');

var config = {
    folder_path: __dirname + "/OEBPS/",
    folder_path_write: "/morpho/output/",
    //TODO use our processing toolkit
    insert : function(/*node*/) { return 1; },
    remove : function(/*node*/) { return 1; },
    update : function(stringA, stringB) { return stringA !== stringB ? 1 : 0; },
}
config.xhtml = config.folder_path + "xhtml/"
config.sourceTxt = config.folder_path + "hadiths.post3.txt"
config.sourcePage = config.folder_path + "sourcePage.txt"
config.chapters = config.folder_path + "chapters.json"
var fourty = fs.readFileSync(config.folder_path +"42Hadiths.txt", "utf-8").split("\n")

class RiyadhCorpus {
    constructor(config) {

        this.currentChapter = "info"
        this.counterHid = 1
        this.books = []
        this.hadiths = {}

        this.fourty = fourty.map((x,i)=>new Object({distance:1000,i:i,text:x.replace(/[ًٌٍَُِّْ]/g,"")}))
        this.results = []
        // this.folder_path = config.folder_path
        // this.folder_path_write = config.folder_path_write
        this.config = config
        this.regex = {
            hadith: new RegExp(/الحديث: ([0-9]+) ¦/),
            // chapter : new RegExp(/¦ الجزء: ([0-9]+) ¦/),
            page: new RegExp(/¦ الصفحة: ([0-9]+)/),
            footnoteBeginning: new RegExp(/^\( *[0-9] *\)/),
            footnote: new RegExp(/\([0-9]\)/),
        }
    }
    toFixMisMatchingLineNumber(sourceTxt){
        var correct = fs.readFileSync(config.sourceTxt.replace("3","2"), "utf-8").split("\n")
        var arr = []
        sourceTxt.forEach((x,i)=>{
            var a =x.split(" ").slice(0,3).join(" ").replace(/[ًٌٍَُِّْ]/g,"")
            if(!correct[i])
                return
            var b =correct[i].split(" ").slice(0,3).join(" ").replace(/[ًٌٍَُِّْ]/g,"").replace(/-LRB-/g,"(").replace(/-RRB-/g,")")
            if(i<=674)
                return

            if(a != b){
                arr.push([i,a,b])
            }
        })
        console.error(arr.length);
        console.error(arr[0]);
        process.exit(1)

    }
    is42Hadith(obj){
        var a = obj.hadith.replace(/[ًٌٍَُِّْ]/g,"")
        this.fourty.forEach((x,i)=>{
            if(!a.split("\"")[1])
                return
            if(x.sim < 0.05)
                return
            var d = ed.levenshtein(a.split("\"")[1], x.text.split("\"")[1], config.insert, config.remove, config.update);
            
            if(d.distance<=x.distance){
                x.distance = d.distance
                x.sim = d.distance / (a.split("\"")[1].length + x.text.split("\"")[1].length)
                if(x.sim < 0.2){
                    x.obj = obj
                    obj.fourty = i
                }
                x.hadith = obj.hadith
            }
        })
        process.stderr.write(obj.sourcePage+"         \r")
        // if(obj.sourcePage == 1000){
            // console.log(JSON.stringify(this.fourty));
            // process.exit(1)
        // }
    }
    init() {
        //TODO use our processing toolkit
        var sourceTxt = fs.readFileSync(config.sourceTxt, "utf-8").split("\n")
        var sourcePage = fs.readFileSync(config.sourcePage, "utf-8").split("\n")
        var chapters = JSON.parse(fs.readFileSync(config.chapters, "utf-8"))


        if (sourcePage.length != sourceTxt.length){
            console.error("ERROR: mismatch sourcePage and hadiths",sourcePage.length," != ",sourceTxt.length)
            this.toFixMisMatchingLineNumber(sourceTxt)
        }
        for (let i in sourceTxt)
            this.hadiths[sourcePage[i]] = sourceTxt[i]

        var thisbook = null
        var books = []
        for (let ch of chapters) {
            if (ch[1].indexOf(" كتاب ") >= 0) {
                thisbook = {
                    id: ch[0],
                    name: ch[1],
                    page: ch[2],
                    num: parseInt(ch[1].split("-")[0]),
                    clean_name: (ch[1].split("-")[1] || ch[1].split("-")[0]).trim(),
                    chapters: []
                }
                books.push(thisbook)
            } else {
                thisbook.chapters.push({
                    id: ch[0],
                    name: ch[1],
                    page: ch[2],
                    num: parseInt(ch[1].split("-")[0]),
                    clean_name: (ch[1].split("-")[1] || ch[1].split("-")[0]).trim()
                })
            }
        }


        for (let i = 1; i < 2107; i++) {
            // var i=783; if(true){
            var r = this.process(fs.readFileSync(this.config.xhtml + "/P" + i + ".xhtml", "utf-8"), i)
            if (r) {
            	var path = this.config.folder_path_write + "hadiths-P" + i;
            	if(!fs.existsSync(path))
            		fs.mkdirSync(path)
                if(process.argv.indexOf("--write"))
                    fs.writeFileSync(path + "/SOURCE", r.hadith)
                this.results.push(r)
            }
        }
        this.final_results = {
            hadiths: this.results,
            fourty: this.fourty,
            books: books,
        }
        console.log(JSON.stringify(this.final_results, null, 3));
    }

    getFinalResults() {
        return this.final_results;
    }
    process(xml, f) {
        var $ = cheerio.load(xml, {
            normalizeWhitespace: true,
            xmlMode: true,
            decodeEntities: false
        });


        // console.log($('body').text())
        var result = {};
        result.sourcePage = f
        if (f < 11)
            result.type = "info"

        result.orig = $('#book-container').html()
        if ($('#book-container > a').get().length > 0) {
            var id = $('#book-container > a').attr("id");
            $('#book-container > a').remove();

            var title = $('#book-container span.title').first().text();
            if (/كتَ?اب/.test(title.replace(/\u0600-\u0620/g, ""))) {
                this.books.push($('#book-container span.title').first().text())
                $('#book-container span.title').first().remove();
                // result.type = "newChapter"
            }
            // bab
            // var chapter = $('span.red','#book-container').first().text().replace(/[ -]/g,'');
            title = $('#book-container span.title').first().text();
            if (/باب/.test(title)) {
                $('#book-container span.red').first().remove();
                $('#book-container span.title').first().remove();
                result.type = "newChapter"
            }
            this.currentChapter = id
            // console.error(id,this.currentChapter)

        }

        var hid = $('span.red', '#book-container').first().text().replace(/[ -]/g, '')
        if (parseInt(hid) == this.counterHid && f > 10) {
            result.hid = this.counterHid++
                $('#book-container span.red').remove();
        }
        result.ch = this.currentChapter
        if (/\[ص:/.test($('#book-container span.title').text()))
            $('#book-container span.title').remove();

        var footnote = $('#book-container span.footnote').html()
        $('#book-container span.footnote').remove()
        $('#book-container span.footnote-hr').remove()

        result.hadith_orig = $('#book-container').text().trim()
        if (this.hadiths["P" + result.sourcePage + ".xhtml"]) {
            result.hadith = this.hadiths["P" + result.sourcePage + ".xhtml"].replace(/-LRB- ([0-9]+) -RRB-/g, "\($1\)")
        } else // or concatenate it to previous 
            result.hadith = this.results[this.results.length - 1].hadith_par
        var wordsArr = result.hadith.split(/ /)

        if (footnote)
            footnote = footnote.split(/<br *\/>/)

        // join if does not have a number to previous footnote
        var newFootnote = []
        for (let i in footnote){
            if (!this.regex.footnoteBeginning.test(footnote[i]) && newFootnote.length > 0) {
                newFootnote[newFootnote.length - 1] += " " + footnote[i]
            }
            else
                newFootnote.push(footnote[i])
        }


        var prev = {}
        result.footnotes = []
        //Case of 31 pages where hadith continues to next page
        if (!result.hid && result.type === null) {
            if (false) console.error(JSON.stringify({
                hid: result.hid,
                hadith: result.hadith,
                page: result.pageId,
                sourcePage: this.config.xhtml + "P" + result.sourcePage + ".xhtml",
            }))


            prev = this.results[this.results.length - 1]
            if (!prev.groupPages)
                prev.groupPages = [prev.sourcePage]
            prev.groupPages.push(result.sourcePage)

            // result.footnotes = prev.footnotes

            // if(!this.hadiths["P"+result.sourcePage+".xhtml"])
            // 	prev.hadith += result.hadith
            prev.orig += result.orig
            result.type = "group"
        } else
            result.type = "hadith"


        for (let i in newFootnote) {
            var num = /( *[0-9] *)/.exec(newFootnote[i])
            var paras = newFootnote[i].replace(/(\( [0-9] \))/g, "\($1\)").trim().split(" ")[0]
            // console.error(paras,wordsArr.indexOf(paras))
            if (num !== null)
                num = parseInt(num[1])

            var ind = wordsArr.indexOf(paras)
            var footnotes = result.type == "group" ? prev.footnotes : result.footnotes
            for (var ft of footnotes)
                if (ft.location == ind) {
                    ind = wordsArr.indexOf(paras, ft.location + 1)
                }
            footnotes.push({
                num: num,
                location: ind,
                text: newFootnote[i]
            })


            //for debugging
            if (false && wordsArr.indexOf(paras) == -1)
                console.error({
                    num: num,
                    paras: paras,
                    location: ind,
                    text: newFootnote[i],
                    arr: wordsArr.join(" "),
                    hid: result.hid,
                    sourcePage: result.sourcePage,
                    ft: footnote,
                    nft: newFootnote
                })


        }
        // if(result.footnotes.length>0)
        // 	console.error(result.footnotes);
        result.hadith = wordsArr.filter(w => !this.regex.footnote.test(w)).join(" ")
        this.is42Hadith(result)
        result.hadith_par = wordsArr.join(" ")

        result.where = $('body div.center').text()
        result.hadithId = this.regex.hadith.exec(result.where)
        result.hadithId = result.hadithId !== null ? result.hadithId[1] : "?"
        // result.chapterId= this.regex.chapter.exec(result.where)
        // result.chapterId = result.chapterId !=null ? result.chapterId[1] : "?"
        result.pageId = this.regex.page.exec(result.where)
        result.pageId = result.pageId !== null ? result.pageId[1] : "?"

        if (result.type != "group")
            return result
    }
}

var r = new RiyadhCorpus(config)
r.init()
