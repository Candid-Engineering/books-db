<script lang="ts">
  import 'bulma/css/bulma.css'
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<header>
  <nav class="navbar section pt-0" aria-label="main navigation">
    <!-- See: https://bulma.io/documentation/components/navbar/ -->
    <div class="navbar-brand">
      <a class="navbar-item" href="/">📚 BooksDB </a>
      <a
        href="#placeholder"
        role="button"
        class="navbar-burger"
        aria-label="menu"
        aria-expanded="false"
        data-target="navbarBasicExample"
      >
        <!-- "hamburger menu" lines: -->
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>
    <div class="navbar-menu">
      <div class="navbar-start">
        <a class="navbar-item" href="/">Home</a>
        <a class="navbar-item" href="/about">About</a>
      </div>
    </div>
  </nav>
</header>
<main>
  <section class="section">
    <slot></slot>
  </section>
</main>
