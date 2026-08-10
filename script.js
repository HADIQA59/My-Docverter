document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       ELEMENTS
    ========================================= */

    const header = document.getElementById("siteHeader");
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    const navLinks = document.querySelectorAll(".nav-link");
    const currentYear = document.getElementById("currentYear");


    /* =========================================
       CURRENT YEAR
    ========================================= */

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    /* =========================================
       MOBILE MENU
    ========================================= */

    if (menuToggle && mainNav) {

        menuToggle.addEventListener("click", function () {

            const isOpen =
                mainNav.classList.toggle("open");

            menuToggle.setAttribute(
                "aria-expanded",
                isOpen
            );

            if (isOpen) {

                menuToggle.innerHTML =
                    '<i class="fa-solid fa-xmark"></i>';

                menuToggle.setAttribute(
                    "aria-label",
                    "Close menu"
                );

            } else {

                menuToggle.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

                menuToggle.setAttribute(
                    "aria-label",
                    "Open menu"
                );
            }

        });
    }


    /* =========================================
       CLOSE MOBILE MENU
       AFTER CLICKING LINK
    ========================================= */

    navLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            navLinks.forEach(function (item) {
                item.classList.remove("active");
            });

            this.classList.add("active");


            if (mainNav.classList.contains("open")) {

                mainNav.classList.remove("open");

                menuToggle.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

                menuToggle.setAttribute(
                    "aria-label",
                    "Open menu"
                );
            }

        });

    });


    /* =========================================
       HEADER SCROLL EFFECT
    ========================================= */

    function handleHeaderScroll() {

        if (window.scrollY > 20) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }

    }

    window.addEventListener(
        "scroll",
        handleHeaderScroll
    );

    handleHeaderScroll();


    /* =========================================
       SMOOTH SCROLL
    ========================================= */

    document
        .querySelectorAll('a[href^="#"]')
        .forEach(function (link) {

            link.addEventListener(
                "click",
                function (event) {

                    const targetId =
                        this.getAttribute("href");

                    if (
                        targetId === "#" ||
                        targetId === ""
                    ) {
                        return;
                    }

                    const target =
                        document.querySelector(targetId);

                    if (target) {

                        event.preventDefault();

                        const headerHeight =
                            header.offsetHeight;

                        const targetPosition =
                            target.getBoundingClientRect().top +
                            window.scrollY -
                            headerHeight;

                        window.scrollTo({
                            top: targetPosition,
                            behavior: "smooth"
                        });

                    }

                }
            );

        });


    /* =========================================
       UPDATE ACTIVE NAV ON SCROLL
    ========================================= */

    const sections =
        document.querySelectorAll("main section[id]");


    function updateActiveNav() {

        let currentSection = "";

        const scrollPosition =
            window.scrollY + 150;


        sections.forEach(function (section) {

            const sectionTop =
                section.offsetTop;

            const sectionHeight =
                section.offsetHeight;

            if (
                scrollPosition >= sectionTop &&
                scrollPosition <
                sectionTop + sectionHeight
            ) {

                currentSection =
                    section.getAttribute("id");

            }

        });


        if (currentSection) {

            navLinks.forEach(function (link) {

                link.classList.remove("active");

                const linkTarget =
                    link.getAttribute("href");

                if (
                    linkTarget ===
                    "#" + currentSection
                ) {
                    link.classList.add("active");
                }

            });

        }

    }


    window.addEventListener(
        "scroll",
        updateActiveNav
    );


    /* =========================================
       CLOSE MENU WHEN CLICKING OUTSIDE
    ========================================= */

    document.addEventListener(
        "click",
        function (event) {

            if (
                mainNav &&
                menuToggle &&
                mainNav.classList.contains("open") &&
                !mainNav.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {

                mainNav.classList.remove("open");

                menuToggle.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }

        }
    );


    /* =========================================
       ESCAPE KEY CLOSES MENU
    ========================================= */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                mainNav.classList.contains("open")
            ) {

                mainNav.classList.remove("open");

                menuToggle.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            }

        }
    );

});

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       ELEMENTS
    ========================================= */

    const uploadArea =
        document.getElementById("uploadArea");

    const chooseFileBtn =
        document.getElementById("chooseFileBtn");

    const fileInput =
        document.getElementById("heroFileInput");

    const selectedFile =
        document.getElementById("selectedFile");

    const fileName =
        document.getElementById("fileName");

    const fileSize =
        document.getElementById("fileSize");

    const removeFile =
        document.getElementById("removeFile");

    const convertBtn =
        document.getElementById("convertBtn");


    /* =========================================
       CHOOSE FILE
    ========================================= */

    chooseFileBtn.addEventListener(
        "click",
        function () {

            fileInput.click();

        }
    );


    /* =========================================
       FILE INPUT CHANGE
    ========================================= */

    fileInput.addEventListener(
        "change",
        function () {

            if (this.files.length > 0) {

                handleFile(this.files[0]);

            }

        }
    );


    /* =========================================
       HANDLE FILE
    ========================================= */

    function handleFile(file) {

        /* Maximum size = 50 MB */

        const maxSize =
            50 * 1024 * 1024;

        if (file.size > maxSize) {

            alert(
                "File size must be less than 50 MB."
            );

            resetFile();

            return;
        }


        /* Show file information */

        fileName.textContent =
            file.name;

        fileSize.textContent =
            formatFileSize(file.size);


        selectedFile.classList.add("show");

        uploadArea.style.display = "none";


        /* Enable conversion */

        convertBtn.disabled = false;

    }


    /* =========================================
       FORMAT FILE SIZE
    ========================================= */

    function formatFileSize(bytes) {

        if (bytes === 0) {
            return "0 Bytes";
        }

        const units =
            [
                "Bytes",
                "KB",
                "MB",
                "GB"
            ];

        const index =
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            );

        return (
            parseFloat(
                (bytes /
                    Math.pow(1024, index)
                ).toFixed(2)
            ) +
            " " +
            units[index]
        );

    }


    /* =========================================
       REMOVE FILE
    ========================================= */

    removeFile.addEventListener(
        "click",
        function () {

            resetFile();

        }
    );


    function resetFile() {

        fileInput.value = "";

        selectedFile.classList.remove(
            "show"
        );

        uploadArea.style.display =
            "block";

        convertBtn.disabled = false;

    }


    /* =========================================
       DRAG & DROP
    ========================================= */

    uploadArea.addEventListener(
        "dragover",
        function (event) {

            event.preventDefault();

            uploadArea.classList.add(
                "dragover"
            );

        }
    );


    uploadArea.addEventListener(
        "dragleave",
        function () {

            uploadArea.classList.remove(
                "dragover"
            );

        }
    );


    uploadArea.addEventListener(
        "drop",
        function (event) {

            event.preventDefault();

            uploadArea.classList.remove(
                "dragover"
            );


            const files =
                event.dataTransfer.files;


            if (files.length > 0) {

                const file =
                    files[0];

                fileInput.files =
                    files;

                handleFile(file);

            }

        }
    );


    /* =========================================
       CONVERT BUTTON
    ========================================= */

    convertBtn.addEventListener(
        "click",
        function () {

            if (!fileInput.files.length) {

                alert(
                    "Please select a file first."
                );

                return;

            }


            const originalText =
                convertBtn.innerHTML;


            /* Loading state */

            convertBtn.disabled = true;

            convertBtn.innerHTML =
                `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Converting...
                `;


            /*
                Demo conversion.

                Actual conversion backend
                will be connected later.
            */

            setTimeout(
                function () {

                    convertBtn.innerHTML =
                        `
                        <i class="fa-solid fa-check"></i>
                        Conversion Ready
                        `;


                    setTimeout(
                        function () {

                            convertBtn.innerHTML =
                                originalText;

                            convertBtn.disabled =
                                false;

                        },
                        2000
                    );

                },
                2000
            );

        }
    );

});