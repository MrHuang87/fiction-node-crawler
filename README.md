# 基本流程
1)从小说网站的搜索框，小说名称或者小说作家，获取想要的小说的搜索结果

2)获取作家的所有小说列表

3)获取指定小说的章节列表

4)根据当前网站当前小说的上次阅读小说的更新时间，获取该更新时间之后的所有小说章节，并保存

5)小说的元数据为：作者/名称/简介/最后更新时间/当前阅读章节的更新时间

6)小说章节的元数据为： 作者/小说名称/章节名称/章节序号/本章节更新时间

7)小说目录列表： 小说名称/章节列表数据

8)保存数据的目录结构
-作者
--小说名称
---TOC和各个小说章节内容

# node技术选型
node适合处理高io低cpu消耗的场景，且有大量的工具包

- request 发送http请求
- cheerio 解析爬取的html，语法为jquery的子集
- charset-parser 根据响应信息中的数据获取字符集信息
- iconv-lite 字符集转换

# Q&A
## cheerio
- :eq
JQUERY写法
```
$row.find('td:eq(0)').text()
```
cheerio写法
```
$row.find('td').eq(0).text()
```