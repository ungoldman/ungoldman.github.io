var githubUser = function(username, callback) {
  $.ajax({
    data: {
      type: 'all',
      sort: 'updated'
    },
    url: "https://api.github.com/users/" + username + "/repos",
    dataType: "jsonp",
    success: callback
  });
}

jQuery.fn.loadRepositories = function(username) {
  // this.html("<span>Querying GitHub for repositories...</span>");

  var target = this;
  githubUser(username, function(response) {
    var repos = response.data;
    // sortByNumberOfWatchers(repos);

    var tpl = $('<div class="card"> \
      <h3 class="repo-title"><a class="repo-link" href=""></a></h3> \
      <p class="repo-desc"></p> \
    </div>');

    target.empty();
    $(repos).each(function(i) {
      if (i > 4) {
        return;
      }
      var el = tpl.clone();
      var updated = new Date(this.updated_at).toLocaleDateString();
      el.find('.repo-link').text(this.full_name);
      if (this.homepage) {
        el.find('.repo-link').attr('href', this.url)
      }
      el.find('.repo-desc').text(this.description);
      el.find('.repo-title').after('<p><small class="text-muted">' + updated + '</small></p>');
      target.append(el);
    });
  });

  function sortByNumberOfWatchers(repos) {
    repos.sort(function(a,b) {
      return b.stargazers_count - a.stargazers_count;
    });
  }

  return this;
};