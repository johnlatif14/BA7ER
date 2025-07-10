function Navbar({ setPage }) {
  return (
    <nav className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800">
      <h1 className="text-xl font-bold cursor-pointer" onclick={() => setPage("home")}>
        ?? ???? ???????
      </h1>
      <div className="space-x-4">
        <button onClick={() => setPage("home")}>????????</button>
        <button onClick={() => setPage("products")}>????????</button>
        <button onClick={() => setPage("contact")}>???????</button>
        <button onClick={() => setPage("suggestions")}>??????</button>
      </div>
    </nav>
  );
}

export default Navbar;
