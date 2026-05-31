import Button from '../forms/Button';
const React = require('react');
const BoardToken = '55cced6a-d7be-3f75-79f5-7b2b81803b7d';

export default class Feedback extends React.Component {
  componentDidMount() {
    // (function (w, d, i, s) {
    //   function l() {
    //     if (!d.getElementById(i)) {
    //       var f = d.getElementsByTagName(s)[0],
    //         e = d.createElement(s);
    //       (e.type = 'text/javascript'),
    //         (e.async = !0),
    //         (e.src = 'https://canny.io/sdk.js'),
    //         f.parentNode.insertBefore(e, f);
    //     }
    //   }
    //   if ('function' != typeof w.Canny) {
    //     var c = function () {
    //       c.q.push(arguments);
    //     };
    //     (c.q = []),
    //       (w.Canny = c),
    //       'complete' === d.readyState
    //         ? l()
    //         : w.attachEvent
    //         ? w.attachEvent('onload', l)
    //         : w.addEventListener('load', l, !1);
    //   }
    // })(window, document, 'canny-jssdk', 'script');
    !(function (w, d, i, s) {
      function l() {
        if (!d.getElementById(i)) {
          var f = d.getElementsByTagName(s)[0],
            e = d.createElement(s);
          (e.type = 'text/javascript'),
            (e.async = !0),
            (e.src = 'https://canny.io/sdk.js'),
            f.parentNode.insertBefore(e, f);
        }
      }
      if ('function' != typeof w.Canny) {
        var c = function () {
          c.q.push(arguments);
        };
        (c.q = []),
          (w.Canny = c),
          'complete' === d.readyState
            ? l()
            : w.attachEvent
            ? w.attachEvent('onload', l)
            : w.addEventListener('load', l, !1);
      }
    })(window, document, 'canny-jssdk', 'script');

    window.Canny &&
      Canny('initChangelog', {
        appID: '607baa7674e4aa4690b2203e',
        position: 'bottom',
        align: 'right',
      });
  }

  render() {
    return (
      <Button data-canny-changelog secondary={true}>
        Changelog
      </Button>
    );
  }
}
