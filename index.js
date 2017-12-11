'use strict';

const request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    _ = require('lodash'),
    path = require('path'),
    urlencode = require('urlencode'),
    querystring = require('querystring'),
    fsExtra = require('./lib/fsExtra'),
    charsetParser = require('charset-parser'),
    iconvLite = require('iconv-lite'),
    config = require('./config.json');


const siteEncoding = config.siteEncoding;
const fictionRepository = config.fictionRepository;
let host = config.host;
let website = `http://${host}`;
let searchURL = `${website}/${config.searchPagePath}`;

let searchCondition = config.searchCondition;
// articlename| author
let searchForm = {
    searchtype: 'articlename',
    searchkey: searchCondition.name
};

var postData = querystring.stringify(searchForm, null, null, {
    encodeURIComponent: function (str) {
        var chinese = new RegExp(/[^\x00-\xff]/g);
        if (chinese.test(str)) { //
            return urlencode.encode(str, siteEncoding);
        } else {
            return querystring.escape(str);
        }
    }
});

var request_write = request.post({
    url: searchURL,
    encoding: null,
    // proxy: 'http://127.0.0.1:8080',
    headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:54.0) Gecko/20100101 Firefox/54.0',
        'Referer': website,
        'host': host,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
}, function (err, response, body) {

    if (err) {
        console.error(err);
    } else {
        // 如果直接就可以定位到文章，直接返回302
        
        if (response.statusCode == 302) {
            var articleIndexLink = response.headers['location'];
            
            if (!articleIndexLink) {
                return console.error('302 没有返回重定向的地址');
            }

            getArticleIndexPage(articleIndexLink);
        } else {
            // TODO 通过列表来查找对应的文章
            var charset = charsetParser(contentType(response));
            // 获取字符集解码后的页面
            var page = iconvLite.decode(body, charset);
    
            const $ = cheerio.load(page);
    
            const title = $('title').text();
    
            // 获取查询结果
            var rows = getArticleList($);
            // 保存列表数据

        }

    }
});

// 这种方式写body避免中文url编码自动转为utf8的问题
request_write.write(postData);

function getArticleList($){
    var rows = [];
    var searchResults = $('#content tr');
    searchResults.each(function (index, element) {
        if (index === 0) {
            return;
        }
        var $row = $(element);
        rows.push({
            name: $row.find('td').eq(0).text(),
            latestChapter: $row.find('td').eq(1).text(),
            author: $row.find('td').eq(2).text(),
            latestUpdateTime: $row.find('td').eq(4).text(),
            status: $row.find('td').eq(5).text(),
            tocUrl: $row.find('td').eq(1).find('a').attr('href')
        });
    });
    return rows;
}

function getArticleIndexPage(articleIndexLink){
    request(articleIndexLink,{encoding: null}, function(err, response, body) {
        if (err) {
            console.error(err);
        } else {
            var charset = charsetParser(contentType(response));
            
            // 获取字符集解码后的页面
            var page = iconvLite.decode(body, charset);
            const $ = cheerio.load(page);
            
            
            var chapterListLink = $(`a[title="点击阅读《${searchCondition.name}》"]`).attr('href');
            // console.log(chapterListLink);
            var lastUpdateTimeText = $('#content > table > tbody > tr > td > table > tbody').find('tr').eq(3).find('td').eq(0).text();
            var lastUpdateTIme = _.trim(lastUpdateTimeText.split('：')[1]); // 中文的分隔符

            var authorText = $('#content > table > tbody > tr > td > table > tbody').find('tr').eq(2).find('td').eq(1).text();
            var author = _.trim(authorText.split("：")[1]);
            // console.log(author);

            if (_.isEmpty(author)){
                console.error('查找不到作者名称');
                return;
            }

            // 创建作者名称的目录，该作者名称下级再创建小说名称的目录
            var fictionDir = path.join(fictionRepository, author, searchCondition.name);
            fsExtra.mkdirs(fictionDir, function(){
                getToC(chapterListLink, fictionDir);
                // 获取章节列表页面
            });
        }
    });
}

function getToC(chapterListLink, authorDir) {
    request(chapterListLink, {encoding: null}, function(err, response, body){
        if (err) {
            console.error(err);
        } else {
            var charset = charsetParser(contentType(response));
            
            // 获取字符集解码后的页面
            var page = iconvLite.decode(body, charset);
            const $ = cheerio.load(page);
            
            // 生成TOC
            var chapters = [];
            $('.centent').find('a').each(function(index, element){
                var relativePath =  $(element).attr('href');
                var chapter = {
                    link: `${chapterListLink}${relativePath}`,
                    name: $(element).text()
                };
                chapters.push(chapter);
            });
            // 获取章节列表
            var tocPath = path.join(authorDir, 'toc.json');
            writeToFile(JSON.stringify(chapters), tocPath);
            fetchChaptersByToc(tocPath);
        }        
    });
}

function fetchChaptersByToc(tocPath){
    // 加载toc.json
    fs.readFile(tocPath, function(err, data){
        if (err){
            throw err;
        }
        var chapters = JSON.parse(data.toString('utf8'));
        if (_.isEmpty(chapters)){
            console.log('%s不存在目录列表', tocPath);
        }

        var tocDir = path.dirname(tocPath);
        _.forEach(chapters, function(chapter){
            // 查找本地是否有name同名的文本文件，如果没有则抓取link对应的章节数据，保存在本地
            var localFilePath = path.join(tocDir, `${chapter.name}.txt`);
            fs.exists(localFilePath, function(exists){
                if (!exists){
                    fetchOneChapter(chapter.link, localFilePath);
                    //method(chapter.link, localFilePath);
                }
            });
        });
    });
};

function fetchOneChapter(chapterLink, localFilePath){
    request(chapterLink, {encoding: null}, function(err, response, body){
        if (err) {
            console.error(err);
        } else {
            var charset = charsetParser(contentType(response));
            
            // 获取字符集解码后的页面
            var page = iconvLite.decode(body, charset);
            const $ = cheerio.load(page);
            
            var nodes = $('body').contents();
            var contentStartIndex = 0, contentEndIndex = 0;
            nodes.each(function(index, element){
                if (element.type === 'tag' 
                    && element.name=== 'table'
                    && contentStartIndex===0){
                        contentStartIndex = index;
                }

                if (contentStartIndex !== 0 
                    && contentEndIndex === 0
                    && element.type === 'comment'){
                        contentEndIndex = index;
                }
            });

            var contentNodes = _.filter(nodes, function(node, index){
                if (index> contentStartIndex 
                    && index < contentEndIndex
                    && node.type === 'text'){
                    return true;
                } else {
                    return false;
                }
            });

            var content = '';
            if (contentNodes&& contentNodes.length> 0){
                contentNodes.forEach(function(element, index){
                    content += element.data + '\n';
                });
            }

            if (content){
                // 写入文件内容
                // console.log(localFilePath);
                writeToFile(content, localFilePath);
            }
        }        
    });
};

function writeToFile(str, filepath) {
    var writableStream = fs.createWriteStream(filepath, {
        encoding: 'utf8'
    });
    writableStream.write(str);
}

function contentType(res) {
    return get(res, 'content-type');
}

function get(res, field) {
    return res.headers[field.toLowerCase()] || '';
}