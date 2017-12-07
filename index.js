'use strict';

const request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    charsetParser = require('charset-parser'),
    iconvLite = require('iconv-lite');

let website = 'http://www.piaotian.com/';

request({url: website, encoding: null}, function(err, response, body){
    if (err){
        console.error(err);
    } else {
        var charset = charsetParser(contentType(response));
        
        // 获取字符集解码后的页面
        var page = iconvLite.decode(body, charset);
        
        const $ = cheerio.load(page);
        
        // 获取title
        var title = $('title').text();
        console.log(title);
    }
});


function contentType(res){
    return get(res,'content-type');
}

function get(res,field){
    return res.headers[field.toLowerCase()] || '';
}
