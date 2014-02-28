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
      if (i > 4) return;

      var el = tpl.clone();
      var updated = new Date(this.updated_at);
      updated = updated.toLocaleDateString() + ', ' + updated.toLocaleTimeString();

      var details = [];

      details.push('<small class="text-muted fa fa-clock-o"> ' + updated + '</small>');
      details.push('<small class="text-muted fa fa-star"> ' + this.stargazers_count + '</small>');
      details.push('<small class="text-muted fa fa-eye"> ' + this.watchers_count + '</small>');
      details.push('<small class="text-muted fa fa-code-fork"> ' + this.forks_count + '</small>');

      var deets = $('<p/>').append(details.join(' &nbsp;&nbsp; '));

      el.find('.repo-link').text(this.full_name).attr('href', this.html_url);
      el.find('.repo-desc').text(this.description);
      el.find('.repo-title').after(deets);
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