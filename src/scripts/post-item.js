import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

const form = document.querySelector("#item-form");
const message = document.querySelector("#message");
const categorySelect = document.querySelector("#category");
const photosInput = document.querySelector("#photos");


async function loadCategories() {

  if (!(categorySelect instanceof HTMLSelectElement)) {
    return;
  }


  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");


  if (error) {

    console.error("Category error:", error);

    if (message instanceof HTMLParagraphElement) {
      message.textContent =
        "Unable to load categories.";
    }

    return;
  }


  const categories = Array.isArray(data)
    ? data
    : [];


  categories.forEach((category) => {

    const option = document.createElement("option");

    option.value = String(category.id);
    option.textContent = String(category.name);

    categorySelect.appendChild(option);

  });

}


loadCategories();



if (form instanceof HTMLFormElement) {


form.addEventListener("submit", async (event) => {


event.preventDefault();



if (!(message instanceof HTMLParagraphElement)) {
  return;
}



message.textContent =
"Posting your item...";



const {
data:{user},
error:userError
}
=
await supabase.auth.getUser();



if(userError || !user){

message.textContent =
"Please login before posting an item.";

return;

}



const formData = new FormData(form);



const titleValue = String(
formData.get("title") || ""
).trim();



const descriptionValue = String(
formData.get("description") || ""
).trim();



const files =
photosInput instanceof HTMLInputElement &&
photosInput.files
?
Array.from(photosInput.files)
:
[];




if(titleValue.length < 5){

message.textContent =
"Item title should be at least 5 characters.";

return;

}




if(descriptionValue.length < 30){

message.textContent =
"Description should be at least 30 characters.";

return;

}




if(files.length === 0){

message.textContent =
"Please upload at least one photo.";

return;

}





const expiresAt = new Date();


expiresAt.setDate(
expiresAt.getDate() + 15
);
const slug = 
`${titleValue.toLowerCase()
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-|-$/g, "")
}-swap`;






const listing = {

user_id:user.id,


title:titleValue,


slug:slug,


description:descriptionValue,


category_id:String(
formData.get("category") || ""
),


country:String(
formData.get("country") || ""
),


city:String(
formData.get("city") || ""
),


landmark:String(
formData.get("landmark") || ""
),


distance:String(
formData.get("distance") || ""
),


condition:String(
formData.get("condition") || ""
),


desired_exchange:String(
formData.get("exchange") || ""
),


expires_at:
expiresAt.toISOString()


};





const {
data:listingData,
error:listingError
}
=
await supabase
.from("listings")
.insert([listing])
.select("id")
.single();





if(listingError || !listingData){


console.error(
"Supabase error:",
listingError
);


message.textContent =
listingError
?
`${listingError.code}: ${listingError.message}`
:
"Unable to create the listing.";


return;

}





const listingId =
listingData.id;



message.textContent =
"Uploading photos...";



const imageRecords = [];




for(
let i=0;
i<files.length;
i++
){


const file = files[i];



const safeFileName =
file.name.replace(
/[^a-zA-Z0-9._-]/g,
"-"
);



const filePath =
`${user.id}/${listingId}/${crypto.randomUUID()}-${safeFileName}`;





const {
error:uploadError
}
=
await supabase.storage
.from("listing-images")
.upload(
filePath,
file
);




if(uploadError){


console.error(
"Photo upload error:",
uploadError
);


message.textContent =
`Listing created, but photo upload failed: ${uploadError.message}`;


return;

}





const {
data:publicUrlData
}
=
supabase.storage
.from("listing-images")
.getPublicUrl(filePath);




imageRecords.push({

listing_id:listingId,

image_url:
publicUrlData.publicUrl,

sort_order:i

});


}





const {
error:imageRecordError
}
=
await supabase
.from("listing_images")
.insert(imageRecords);




if(imageRecordError){


message.textContent =
`Listing created, but photo records failed: ${imageRecordError.message}`;

return;

}





message.textContent =
"Your item has been posted successfully!";


form.reset();



});


}