'use strict';

/**
 * globalnav IntersectionObserver
 */
(function () {

  const startPos = document.querySelector(".p-homeKeyvisual");
  if(startPos){
    // ナビの表示切り替えアクション
    // ============================================================
    const options = {
      root: null,
      rootMargin: '0px 0px -100% 0px',
      threshold: 0
    };
    const observer = new IntersectionObserver(doWhenIntersect, options);
    observer.observe(startPos);

    /**
     * 交差したときに呼び出す関数
     * @param entries
     */
    function doWhenIntersect(entries) {
      entries.forEach(entry => {
        const indexList = document.querySelector('.l-header');
        if (entry.isIntersecting) {
          indexList.classList.remove('is-show');
        } else {
          indexList.classList.add('is-show');
        }
      });
    }
  }
})();
