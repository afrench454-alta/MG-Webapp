import { THEME_STORAGE_KEY } from "../theme";

const THEME_BOOTSTRAP = `(function(){try{var d=document.documentElement;var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"){d.setAttribute("data-theme","dark");d.style.colorScheme="dark"}var short=Math.min(screen.width||0,screen.height||0);var coarse=window.matchMedia("(pointer: coarse)").matches;if(coarse&&short<=926){d.setAttribute("data-phone","true")}}catch(e){}})();`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
    />
  );
}
