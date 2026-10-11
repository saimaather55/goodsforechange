import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");

const form = document.querySelector("#edit-form");
const message = document.querySelector("#message");
const titleInput = document.querySelector("#title");
const categorySelect = document.querySelector("#category");
const cityInput = document.querySelector("#city");
const conditionSelect = document.querySelector("#condition");
const exchangeInput = document.querySelector("#exchange");
const descriptionInput = document.querySelector("#description");
const photosInput = document.querySelector("#photos");
const photoPreview = document.querySelector("#photo-preview");

if (
  !(form instanceof HTMLFormElement) ||
  !(message instanceof HTMLParagraphElement) ||
  !(titleInput instanceof HTMLInputElement) ||
  !(categorySelect instanceof HTMLSelectElement) ||
  !(cityInput instanceof HTMLInputElement) ||
  !(conditionSelect instanceof HTMLSelectElement) ||
  !(exchangeInput instanceof HTMLInputElement) ||
  !(descriptionInput instanceof HTMLTextAreaElement) ||
  !(photosInput instanceof HTMLInputElement)
) {
  console.error("Edit listing form elements were not found.");
} else {
  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Category error:", error);
      message.textContent = "Unable to load categories.";
      return;
    }

    categorySelect.innerHTML =
      '<option value="">Select a category</option>';

    const categories = Array.isArray(data) ? data : [];

    categories.forEach((category) => {
      const option = document.createElement("option");

      option.value = String(category.id);
      option.textContent = String(category.name);

      categorySelect.appendChild(option);
    });
  }

  async function loadListing() {
    if (!listingId) {
      message.textContent = "Listing ID is missing.";
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      message.textContent = "Please login first.";
      return;
    }

    const { data, error } = await supabase
      .from("listings")
      .select(`
        id,
        title,
        description,
        category_id,
        city,
        condition,
        desired_exchange,
        user_id
      `)
      .eq("id", listingId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      console.error("Listing error:", error);
      message.textContent =
        "Listing not found or you do not have permission to edit it.";
      return;
    }

    titleInput.value = data.title || "";
    categorySelect.value = data.category_id
      ? String(data.category_id)
      : "";
    cityInput.value = data.city || "";
    conditionSelect.value = data.condition || "good";
    exchangeInput.value = data.desired_exchange || "";
    descriptionInput.value = data.description || "";
  }

  photosInput.addEventListener("change", () => {
    if (!(photoPreview instanceof HTMLDivElement)) {
      return;
    }

    photoPreview.innerHTML = "";

    const files = photosInput.files
      ? Array.from(photosInput.files)
      : [];

    files.forEach((file) => {
      const image = document.createElement("img");

      image.src = URL.createObjectURL(file);
      image.alt = file.name;

      photoPreview.appendChild(image);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "Saving changes...";

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      message.textContent = "Please login first.";
      return;
    }

    if (!listingId) {
      message.textContent = "Listing ID is missing.";
      return;
    }

    const updatedListing = {
      title: titleInput.value.trim(),
      category_id: categorySelect.value,
      city: cityInput.value.trim(),
      condition: conditionSelect.value,
      desired_exchange: exchangeInput.value.trim(),
      description: descriptionInput.value.trim(),
    };

    const { error: updateError } = await supabase
      .from("listings")
      .update(updatedListing)
      .eq("id", listingId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);

      message.textContent =
        `${updateError.code}: ${updateError.message}`;

      return;
    }

    const files = photosInput.files
      ? Array.from(photosInput.files)
      : [];

    if (files.length > 0) {
      message.textContent = "Uploading photos...";

      const {
        data: existingImages,
        error: existingImageError,
      } = await supabase
        .from("listing_images")
        .select("sort_order")
        .eq("listing_id", listingId)
        .order("sort_order", {
          ascending: false,
        })
        .limit(1);

      if (existingImageError) {
        console.error(
          "Existing image error:",
          existingImageError
        );
      }

      let nextSortOrder = 0;

      if (
        existingImages &&
        existingImages.length > 0
      ) {
        nextSortOrder =
          Number(existingImages[0].sort_order) + 1;
      }

      const imageRecords = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const safeFileName = file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "-"
        );

        const filePath =
          `${user.id}/${listingId}/${crypto.randomUUID()}-${safeFileName}`;

        const { error: uploadError } =
          await supabase.storage
            .from("listing-images")
            .upload(filePath, file);

        if (uploadError) {
          console.error(
            "Photo upload error:",
            uploadError
          );

          message.textContent =
            `Photo upload failed: ${uploadError.message}`;

          return;
        }

        const { data: publicUrlData } =
          supabase.storage
            .from("listing-images")
            .getPublicUrl(filePath);

        imageRecords.push({
          listing_id: listingId,
          image_url: publicUrlData.publicUrl,
          sort_order: nextSortOrder + i,
        });
      }

      if (imageRecords.length > 0) {
        const { error: imageError } =
          await supabase
            .from("listing_images")
            .insert(imageRecords);

        if (imageError) {
          console.error(
            "Image record error:",
            imageError
          );

          message.textContent =
            `Photo record failed: ${imageError.message}`;

          return;
        }
      }
    }

    message.textContent =
      "Your listing has been updated successfully!";

    setTimeout(() => {
      window.location.href = "/my-listings/";
    }, 1000);
  });

  async function start() {
    await loadCategories();
    await loadListing();
  }

  start();
}