var acc=document.getElementsByClassName('accordion');
var i;
var len=acc.length;
for(i=0;i<len;i++){
	acc[i].addEventListener('click', function() {
		this.classList.toggle('active');
		var panel=this.nextElementSibling;
		if(panel.style.maxHeight){
			panel.style.maxHeight=null;
		}else{
			panel.style.maxHeight=panel.scrollHeight + 'px';
		}
	})
}

// if( jQuery(".toggle .toggle-title").hasClass('active') ){
// 		jQuery(".toggle .toggle-title.active").closest('.toggle').find('.toggle-inner').show();
// 	}
// 	jQuery(".toggle .toggle-title").click(function(){
// 		if( jQuery(this).hasClass('active') ){
// 			jQuery(this).removeClass("active").closest('.toggle').find('.toggle-inner').slideUp(200);
// 		}
// 		else{	jQuery(this).addClass("active").closest('.toggle').find('.toggle-inner').slideDown(200);
// 		}
// 	});
