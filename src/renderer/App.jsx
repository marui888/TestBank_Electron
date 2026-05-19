import { useCatStore } from "../stores/catStore"


export default function App() {
  const cats = useCatStore((state) => state.cats)
  const addCat = useCatStore((state) => state.addCat)

  return (
    <div>
      <h1>Hello0 Electron +  React 🚀 </h1>
      <button onClick={() => addCat("Mimi")}>Add Cat</button>

      {cats.map((car) => (
        <div>
          <div key={car.id}>{car.name} , {car.id}</div>
          {/* <div key={cat.id}>{cat.id}</div> */}
        </div>
      ))}

    </div>
  )
}