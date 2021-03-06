'use strict';
const yaml = require('js-yaml');
const fs = require('fs');
const config = yaml.safeLoad(fs.readFileSync('_config.yml', 'utf8'));
const cache = require('./cache');
const Manager = require('./file-manager');

const chunk_size = 64;
const cache_name = 'cache';

module.exports = (socket) => {
  const manager = new Manager(config.base_dir);
  let dist = '';

  cache.get(cache_name, (article) => {
    if (!article) {
      article = {'title': 'Untitled', 'date': new Date(), 'tags': '',
                 'categories': '', 'content': '', 'key': ''};
    }
    socket.emit('init', article);
  });

  socket.on('syncText', (article) => {
    const data = article.data;
    let text = '';
    for (let i in data) {
      if (data[i] === null) {
        text += dist.slice((i * chunk_size), (i * chunk_size) + chunk_size);
        continue;
      }
      if (data[i].pos !== null) {
        text += dist.slice(data[i].pos, data[i].pos + chunk_size);
      } else if (data[i].data) {
        text += data[i].data;
      }
    }
    dist = text;
    article.content = dist;
    if (article.key) {
      cache.put(cache_name + article.key, article);
    } else {
      cache.put(cache_name, article);
    }
    socket.emit('syncEnd', 'finished');
  });

  socket.on('publish', (article) => {
    dist = '';
    const _article = article;
    if (_article.key) {  // When the article already exists
      cache.get(cache_name + _article.key, (cachedArticle) => {
        cachedArticle.date = !_article.date ? cachedArticle.date : _article.date;
        cachedArticle.tags = !_article.tags ? cachedArticle.tags : _article.tags;
        cachedArticle.categories = !_article.categories ? cachedArticle.categories : _article.categories;
        cache.get(cachedArticle.key, (originArticle) => {
          if (originArticle) {
            cachedArticle.filename = originArticle.filename;
          }
          manager.saveToPost(cachedArticle);
        });
      });
    } else {  // New article
      manager.saveToPost(article);
    }
    article = {'title': 'Untitled', 'date': '', 'tags': '',
                  'categories': '', 'content': '', 'key': ''};
    cache.put(cache_name, article);
    socket.emit('publishEnd', 'ok');
  });
};
