import { THEME_STORAGE_KEY } from "../theme";

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark"}}catch(e){}})();`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
    />
  );
}
