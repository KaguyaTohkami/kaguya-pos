"use client";

import type {
  Product,
} from "@/types/pos";


type Props = {
  product: Product | null;

  onClose: () => void;

  onAddCart: (
    product: Product
  ) => void;
};


export default function ProductModal({
  product,
  onClose,
  onAddCart,
}: Props) {

  if (!product) {
    return null;
  }


  return (
    <div
      className="overlay"
      onClick={onClose}
    >

      <div
        className="modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <button
          className="close"
          onClick={onClose}
        >
          ×
        </button>



        <div
          className="detailImage"
        >

          {product.detailImage ||
          product.image ? (

            <img
              src={
                product.detailImage ||
                product.image
              }
              alt={
                product.name
              }
            />

          ) : (

            <span>
              商品画像
            </span>

          )}

        </div>




        <div
          className="modalBody"
        >

          <h2>
            {product.name}
          </h2>


          <strong
            className="modalPrice"
          >
            ¥
            {product.price.toLocaleString(
              "ja-JP"
            )}
          </strong>



          <div
            className="chips"
          >

            {product.categories.map(
              (category) => (

                <span
                  className="chip"
                  key={
                    category
                  }
                >
                  {category}
                </span>

              )
            )}

          </div>




          {product.effects.length >
            0 && (

            <div
              className="modalEffects"
            >

              {product.effects.map(
                (effect) => (

                  <div
                    className="modalEffect"
                    key={
                      effect.type
                    }
                  >

                    <span>
                      {effect.type}
                    </span>


                    <strong>
                      {effect.value}
                    </strong>

                  </div>

                )
              )}

            </div>

          )}




          <p>
            {
              product.description ||
              "説明なし"
            }
          </p>




          <button
            className="primary full"
            onClick={() => {

              onAddCart(
                product
              );

              onClose();

            }}
          >
            カートに追加
          </button>


        </div>


      </div>


    </div>
  );
}
