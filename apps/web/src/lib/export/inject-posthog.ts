export function injectPostHog(
  html: string,
  postHogKey: string,
  postHogHost: string,
  pagePath: string,
): string {
  const script = `<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var u=t.createElement("script");u.type="text/javascript";u.async=!0;u.src=s.api_host+"/static/array.js";var c=t.getElementsByTagName("script")[0];c.parentNode.insertBefore(u,c);var d=e;a!==void 0&&(d=e[a]=[]);d.toString=function(t){return"undefined"!=typeof d&&!0!==t?d:""+(a?a:"posthog")};o=["capture","identify","alias","set_config","unregister","opt_out_capturing","has_opted_out_capturing","opt_in_capturing","reset","isFeatureEnabled","onFeatureFlags","addGroup","setPersonPropertiesForFlags","reloadFeatureFlags","group"];for(n=0;n<o.length;n++)g(d,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${postHogKey}',{api_host:'${postHogHost}',capture_pageview:false});
posthog.capture('$pageview',{page_path:'${pagePath}'});
</script>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${script}</head>`);
  }
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${script}`);
  }
  return script + html;
}
